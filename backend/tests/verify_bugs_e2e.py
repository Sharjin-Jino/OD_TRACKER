import json
import sys
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:5000"

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def request(method, path, data=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{path}"
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return {
                "status": resp.status,
                "json": json.loads(body) if body else {}
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_body)
        except Exception:
            err_json = {"raw": err_body}
        return {
            "status": e.code,
            "json": err_json
        }

def test_all():
    print("==================================================")
    print("STARTING E2E REGRESSION VERIFICATION SUITE")
    print("==================================================")

    # --------------------------------------------------
    # PRE-FLIGHT: HEALTH CHECK
    # --------------------------------------------------
    res = request("GET", "/api/health")
    assert res["status"] == 200, f"Health check failed: {res}"
    log("Backend is healthy and reachable.", "PASS")

    # --------------------------------------------------
    # BUG 1: STUDENT DASHBOARD ISOLATION & AUTHENTICATION
    # --------------------------------------------------
    print("\n--- Testing Bug 1: Student Dashboard & Session Isolation ---")

    # 1.1 Roll number alone must NOT authenticate
    res = request("POST", "/api/auth/login", data={"identifier": "241701038"})
    assert res["status"] in [400, 401], f"Expected 400/401 for missing password, got {res['status']}"
    log("1.1 Roll number alone without password rejected (400/401)", "PASS")

    # 1.2 Wrong password must NOT authenticate
    res = request("POST", "/api/auth/login", data={"identifier": "241701038", "password": "wrongpassword!"})
    assert res["status"] == 401, f"Expected 401 for wrong password, got {res['status']}"
    log("1.2 Wrong password rejected (401)", "PASS")

    # 1.3 Login as Student A (241701038 - Naveen)
    res_a = request("POST", "/api/auth/login", data={"identifier": "241701038", "password": "password123"})
    assert res_a["status"] == 200, f"Login as Student A failed: {res_a}"
    token_a = res_a["json"]["token"]
    user_a = res_a["json"]["user"]
    assert user_a["identifier"] == "241701038", f"Unexpected identifier for Student A: {user_a}"
    log(f"1.3 Logged in as Student A (Name: {user_a['name']}, ID: {user_a['identifier']})", "PASS")

    # Fetch Student A profile and academic data
    headers_a = {"Authorization": f"Bearer {token_a}"}
    me_a = request("GET", "/api/auth/me", headers=headers_a)
    assert me_a["json"]["user"]["identifier"] == "241701038" and "Naveen" in me_a["json"]["user"]["name"]

    acad_a = request("GET", "/api/academic/me", headers=headers_a)
    assert acad_a["json"]["success"] is True and acad_a["json"]["data"]["register_no"] == "241701038"
    log("1.4 Student A verified /api/auth/me and /api/academic/me return Student A data", "PASS")

    # 1.4 Login as Student B (23CSD002 - Priya S)
    res_b = request("POST", "/api/auth/login", data={"identifier": "23CSD002", "password": "password123"})
    assert res_b["status"] == 200, f"Login as Student B failed: {res_b}"
    token_b = res_b["json"]["token"]
    user_b = res_b["json"]["user"]
    assert user_b["identifier"] == "23CSD002", f"Unexpected identifier for Student B: {user_b}"
    log(f"1.5 Logged in as Student B (Name: {user_b['name']}, ID: {user_b['identifier']})", "PASS")

    # Fetch Student B profile and academic data
    headers_b = {"Authorization": f"Bearer {token_b}"}
    me_b = request("GET", "/api/auth/me", headers=headers_b)
    assert me_b["json"]["user"]["identifier"] == "23CSD002" and me_b["json"]["user"]["name"] == "Priya S", (
        f"BUG 1 VIOLATION! Student B sees: {me_b}"
    )
    log(f"1.6 Student B sees ONLY Student B profile ({me_b['json']['user']['name']} - {me_b['json']['user']['identifier']})", "PASS")

    acad_b = request("GET", "/api/academic/me", headers=headers_b)
    assert acad_b["json"]["success"] is True and acad_b["json"]["data"]["register_no"] == "23CSD002", (
        f"BUG 1 VIOLATION! Student B sees academic records for: {acad_b}"
    )
    assert acad_b["json"]["data"]["attendance_percentage"] == 92.1, f"Expected Priya's attendance 92.1, got {acad_b['json']['data']}"
    assert acad_b["json"]["data"]["cat1_marks"] == 95.0, f"Expected Priya's CAT1 95.0, got {acad_b['json']['data']}"
    log(f"1.7 Student B sees ONLY Student B academic record (Attendance: {acad_b['json']['data']['attendance_percentage']}%, CAT1: {acad_b['json']['data']['cat1_marks']})", "PASS")

    # Verify Student B's OD requests are isolated
    ods_b = request("GET", "/api/od-requests/my", headers=headers_b)
    assert ods_b["json"]["success"] is True
    for req in ods_b["json"].get("data", []):
        assert req.get("student_id") in ["STUD002", "23CSD002"] or req.get("register_number") == "23CSD002"
    log("1.8 Student B's OD requests are completely isolated from Student A", "PASS")


    # --------------------------------------------------
    # BUG 2: ADMIN STUDENT EMAIL UPDATES & UNIQUENESS
    # --------------------------------------------------
    print("\n--- Testing Bug 2: Admin Student Email Updates ---")

    # 2.1 Login as Admin
    res_admin = request("POST", "/api/auth/login", data={"identifier": "ADMIN-001", "password": "password123"})
    assert res_admin["status"] == 200, f"Admin login failed: {res_admin}"
    token_admin = res_admin["json"]["token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}
    log("2.1 Logged in as Admin", "PASS")

    # 2.2 Get student list and find STUD003 (Karthik R)
    res_stus = request("GET", "/api/admin/students", headers=headers_admin)
    assert res_stus["status"] == 200
    stus = res_stus["json"]["data"]
    stud3 = next((s for s in stus if s.get("registerNumber") == "23CSD003" or s.get("identifier") == "23CSD003"), None)
    assert stud3 is not None, "Student STUD003 not found"
    stud3_id = stud3["id"]
    orig_email = stud3["email"]
    log(f"2.2 Target Student 3 ID: {stud3_id}, Original Email: {orig_email}", "INFO")

    # 2.3 Attempt duplicate email (already used by Naveen: naveen.23csd@rajalakshmi.edu.in)
    dup_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"email": "priya.23csd@rajalakshmi.edu.in"},
        headers=headers_admin
    )
    assert dup_res["status"] == 409, f"Expected 409 Conflict for duplicate email, got {dup_res['status']}: {dup_res}"
    log("2.3 Duplicate email correctly rejected with 409 Conflict", "PASS")

    # 2.4 Attempt non-college domain email
    invalid_email_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"email": "karthik@gmail.com"},
        headers=headers_admin
    )
    assert invalid_email_res["status"] == 400, f"Expected 400 for non-college email, got {invalid_email_res['status']}"
    log("2.4 Non-college email domain rejected with 400 Bad Request", "PASS")

    # 2.5 Update to a new valid email
    new_email = "karthik.updated@rajalakshmi.edu.in"
    update_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"email": new_email},
        headers=headers_admin
    )
    assert update_res["status"] == 200, f"Email update failed: {update_res}"
    updated_data = update_res["json"]["student"]
    assert updated_data["email"] == new_email, f"Returned student has wrong email: {updated_data['email']}"
    log(f"2.5 Updated email via PUT /api/admin/students/{stud3_id} successfully", "PASS")

    # 2.6 Verify persistence in GET /api/admin/students details endpoint
    verify_res = request("GET", f"/api/admin/students/{stud3_id}", headers=headers_admin)
    assert verify_res["status"] == 200
    details = verify_res["json"]["data"]["student"]
    assert details["email"] == new_email, f"Database did not persist email! Found: {details.get('email')}"
    log(f"2.6 Verified email persistence directly from backend database ({details['email']})", "PASS")

    restore_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"email": "karthik.23csd@rajalakshmi.edu.in"},
        headers=headers_admin
    )
    assert restore_res["status"] == 200
    log("2.7 Cleaned up and restored original student email", "PASS")


    # --------------------------------------------------
    # BUG 3: ADMIN CREDENTIAL (USERNAME & PASSWORD) UPDATES
    # --------------------------------------------------
    print("\n--- Testing Bug 3: Credential Synchronization & Login Verification ---")

    # 3.1 Admin changes Student 3's password to 'newSecurePass456'
    new_pass = "newSecurePass456"
    pass_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"password": new_pass},
        headers=headers_admin
    )
    assert pass_res["status"] == 200, f"Password update failed: {pass_res}"
    log(f"3.1 Admin updated Student 3's password to '{new_pass}'", "PASS")

    # 3.2 Old password 'password123' must be REJECTED
    old_login = request("POST", "/api/auth/login", data={"identifier": "23CSD003", "password": "password123"})
    assert old_login["status"] == 401, f"Old password was NOT invalidated! Status: {old_login['status']}"
    log("3.2 Old password rejected (401 Unauthorized)", "PASS")

    # 3.3 New password 'newSecurePass456' must SUCCEED
    new_login = request("POST", "/api/auth/login", data={"identifier": "23CSD003", "password": new_pass})
    assert new_login["status"] == 200, f"Login with new password failed: {new_login}"
    token_stud3_new = new_login["json"]["token"]
    user_stud3_new = new_login["json"]["user"]
    assert user_stud3_new["identifier"] == "23CSD003"
    log(f"3.3 Login with new password succeeded! Active token acquired for {user_stud3_new['name']}", "PASS")

    # 3.4 Admin changes Student 3's identifier (username/roll number)
    new_roll = "23CSD099"
    roll_res = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"registerNumber": new_roll},
        headers=headers_admin
    )
    assert roll_res["status"] == 200, f"Roll number update failed: {roll_res}"
    log(f"3.4 Admin updated Student 3's roll number to '{new_roll}'", "PASS")

    # Verify old roll number cannot login
    old_roll_login = request("POST", "/api/auth/login", data={"identifier": "23CSD003", "password": new_pass})
    assert old_roll_login["status"] == 401, f"Expected 401 for old roll number, got {old_roll_login['status']}"
    log("3.5 Old roll number rejected on login (401)", "PASS")

    # Verify new roll number logs in successfully
    new_roll_login = request("POST", "/api/auth/login", data={"identifier": new_roll, "password": new_pass})
    assert new_roll_login["status"] == 200, f"Login with new roll number failed: {new_roll_login}"
    log("3.6 New roll number + new password logged in successfully!", "PASS")

    # 3.7 Restore Student 3's roll number and password
    restore_cred = request(
        "PUT",
        f"/api/admin/students/{stud3_id}",
        data={"registerNumber": "23CSD003", "password": "password123"},
        headers=headers_admin
    )
    assert restore_cred["status"] == 200
    log("3.7 Restored Student 3 credentials to default (23CSD003 / password123)", "PASS")

    # Verify default login works again
    restored_login = request("POST", "/api/auth/login", data={"identifier": "23CSD003", "password": "password123"})
    assert restored_login["status"] == 200
    log("3.8 Confirmed restored credentials function properly", "PASS")


    # --------------------------------------------------
    # BUG 4: ADMIN ACADEMIC & DETAIL UPDATES (NO OVERWRITING 80.0)
    # --------------------------------------------------
    print("\n--- Testing Bug 4: Admin Detail & Academic Record Updates ---")

    # 4.1 Update student 1 academic record with cat1=0.0 and cgpa=7.2
    acad_update = request(
        "PUT",
        "/api/admin/students/academic/STUD001",
        data={"cgpa": 7.2, "cat1_marks": 0.0, "overall_attendance": 81.5},
        headers=headers_admin
    )
    assert acad_update["status"] == 200, f"Academic update failed: {acad_update}"
    log("4.1 Academic record updated via PUT /api/admin/students/academic/STUD001", "PASS")

    # 4.2 Verify CAT 1 marks was NOT overwritten by fallback 80.0
    verify_acad = request("GET", "/api/academic/me", headers=headers_a)
    assert verify_acad["json"]["data"]["cgpa"] == 7.2, f"CGPA mismatch: {verify_acad}"
    assert verify_acad["json"]["data"]["cat1_marks"] == 0.0, (
        f"BUG 4 VIOLATION! CAT 1 marks was overwritten by default! Got: {verify_acad['json']['data']['cat1_marks']}"
    )
    log(f"4.2 Confirmed 0.0 marks retained accurately without 80.0 overwrite (cat1: {verify_acad['json']['data']['cat1_marks']})", "PASS")

    # Restore Naveen's academic marks
    restore_acad = request(
        "PUT",
        "/api/admin/students/academic/STUD001",
        data={"cgpa": 8.42, "cat1_marks": 78.0, "overall_attendance": 88.4},
        headers=headers_admin
    )
    assert restore_acad["status"] == 200
    log("4.3 Restored academic record metrics", "PASS")

    print("\n==================================================")
    print("ALL 4 CRITICAL BUG REGRESSION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    try:
        test_all()
    except Exception as e:
        print(f"\n[FAIL] Exception during regression test: {e}", file=sys.stderr)
        sys.exit(1)
