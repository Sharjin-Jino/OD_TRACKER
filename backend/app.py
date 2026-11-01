import os
import sys
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Ensure project root is present in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from backend.config import Config
    from backend.database.sql_server import init_db, SQLServerDB
    from backend.routes.health import health_bp
    from backend.routes.auth import auth_bp
    from backend.routes.od_requests import od_requests_bp
    from backend.routes.mentor import mentor_bp
    from backend.routes.class_incharge import class_incharge_bp
    from backend.routes.hod import hod_bp
    from backend.routes.academic import academic_bp, get_student_academic_detail
    from backend.routes.admin import admin_bp
except ImportError as e:
    if "No module named 'backend'" in str(e):
        from config import Config
        from database.sql_server import init_db, SQLServerDB
        from routes.health import health_bp
        from routes.auth import auth_bp
        from routes.od_requests import od_requests_bp
        from routes.mentor import mentor_bp
        from routes.class_incharge import class_incharge_bp
        from routes.hod import hod_bp
        from routes.academic import academic_bp, get_student_academic_detail
        from routes.admin import admin_bp
    else:
        raise

def create_app(config_class=Config):
    """Application factory for OD Tracking System backend."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Disable strict trailing slashes globally
    app.url_map.strict_slashes = False

    # Enable CORS – origins come from Config which reads CORS_ORIGINS env var
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": config_class.CORS_ORIGINS,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
            }
        },
        supports_credentials=True
    )

    # Initialize Microsoft SQL Server Connection & Schema
    with app.app_context():
        init_db()
        try:
            from backend.scripts.sync_data_registry import sync_students_and_certificates
            sync_students_and_certificates()
        except Exception:
            try:
                from scripts.sync_data_registry import sync_students_and_certificates
                sync_students_and_certificates()
            except Exception as sync_err:
                print(f"[!] Registry sync notice: {sync_err}")

        # Sync existing uploads to Azure Blob Storage if configured
        try:
            from backend.scripts.sync_to_azure_blob import sync_uploads_to_blob
            sync_uploads_to_blob()
        except Exception:
            try:
                from scripts.sync_to_azure_blob import sync_uploads_to_blob
                sync_uploads_to_blob()
            except Exception as blob_sync_err:
                pass

    # Teardown scoped SQLAlchemy session after each request
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        SQLServerDB.close_session()

    # Initialize background 24-hour certificate deadline checker daemon
    try:
        from backend.services.deadline_service import init_deadline_checker
    except ImportError:
        from services.deadline_service import init_deadline_checker
    init_deadline_checker(app, interval_seconds=30)

    # Register Route Blueprints
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(od_requests_bp, url_prefix='/api/od-requests')
    app.register_blueprint(mentor_bp, url_prefix='/api/mentor')
    app.register_blueprint(class_incharge_bp, url_prefix='/api/class-incharge')
    app.register_blueprint(hod_bp, url_prefix='/api/hod')
    app.register_blueprint(academic_bp, url_prefix='/api/academic')
    app.register_blueprint(academic_bp, name='class_incharge_academic', url_prefix='/api/class-incharge/academic')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # Student academic direct route alias: GET /api/students/<student_id>/academic
    @app.route('/api/students/<student_id>/academic', methods=['GET'])
    def student_academic_proxy(student_id):
        return get_student_academic_detail(student_id)

    # Frontend compiled distribution directory (built by Vite)
    frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))

    # Serve compiled static frontend assets (/assets/*)
    @app.route('/assets/<path:filename>')
    def serve_frontend_assets(filename):
        assets_dir = os.path.join(frontend_dist_dir, 'assets')
        if os.path.exists(os.path.join(assets_dir, filename)):
            return send_from_directory(assets_dir, filename)
        return jsonify({"success": False, "error": "Static asset not found."}), 404

    # Serve React SPA index and root-level static assets (e.g. favicon.ico, images)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend_spa(path):
        # API routes are registered on /api/*; do not intercept if somehow caught here
        if path.startswith('api/') or path == 'api':
            return jsonify({"success": False, "error": f"API endpoint '/{path}' not found."}), 404

        # If a specific static file exists in frontend/dist, serve it
        if path:
            candidate_file = os.path.join(frontend_dist_dir, path)
            if os.path.isfile(candidate_file):
                return send_from_directory(frontend_dist_dir, path)

        # For all client-side routes, serve index.html if frontend is built
        index_file = os.path.join(frontend_dist_dir, 'index.html')
        if os.path.exists(index_file):
            return send_from_directory(frontend_dist_dir, 'index.html')

        # Fallback root API message if frontend build is not present (e.g. purely backend dev)
        status = SQLServerDB.get_status()
        return jsonify({
            "message": "OD Tracking System Backend API is active.",
            "health_check": "/api/health",
            "database": {
                "type": "Microsoft SQL Server",
                "connected": status.get("connected", False),
                "state": status.get("connection_state"),
                "database": status.get("database")
            },
            "docs": "REST API for Rajalakshmi Engineering College OD Management System"
        })

    # Global JSON error handlers
    @app.errorhandler(400)
    def handle_bad_request(e=None):
        error_msg = str(getattr(e, 'description', 'Bad Request')) if e else 'Bad Request'
        return jsonify({"success": False, "error": error_msg}), 400

    @app.errorhandler(401)
    def handle_unauthorized(e=None):
        error_msg = str(getattr(e, 'description', 'Authentication required. Please log in.')) if e else 'Authentication required.'
        return jsonify({"success": False, "error": error_msg}), 401

    @app.errorhandler(403)
    def handle_forbidden(e=None):
        error_msg = str(getattr(e, 'description', 'Forbidden: Access denied.')) if e else 'Forbidden: Access denied.'
        return jsonify({"success": False, "error": error_msg}), 403

    @app.errorhandler(404)
    def handle_not_found(e=None):
        # If an HTML route was requested and not found as an API route, serve SPA index
        if not request.path.startswith('/api/'):
            index_file = os.path.join(frontend_dist_dir, 'index.html')
            if os.path.exists(index_file):
                return send_from_directory(frontend_dist_dir, 'index.html')
        return jsonify({
            "success": False,
            "error": "The requested API resource or endpoint was not found."
        }), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(e=None):
        return jsonify({
            "success": False,
            "error": f"HTTP method '{request.method}' is not allowed for this endpoint."
        }), 405

    @app.errorhandler(413)
    def handle_payload_too_large(e=None):
        return jsonify({
            "success": False,
            "error": "Uploaded file is too large. Maximum allowed upload size is 16MB."
        }), 413

    @app.errorhandler(500)
    def handle_internal_server_error(e=None):
        return jsonify({
            "success": False,
            "error": "An internal server error occurred while processing the request."
        }), 500

    return app

# Expose application instance for WSGI servers (gunicorn, uvicorn, etc.)
app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # debug is controlled by Config.DEBUG which reads FLASK_ENV env var
    debug = app.config.get('DEBUG', False)
    use_reloader = os.environ.get('USE_RELOADER', 'false').lower() in ('true', '1')
    print(f"[*] OD Tracking Backend starting on http://0.0.0.0:{port}", flush=True)
    print(f"[*] Debug mode: {debug} (Reloader: {use_reloader})", flush=True)
    print(f"[*] CORS enabled for: {Config.CORS_ORIGINS}", flush=True)
    print(f"[*] Health check: http://0.0.0.0:{port}/api/health", flush=True)
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=use_reloader)
