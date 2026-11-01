import os
import re
import io
import difflib
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from PIL import Image

try:
    import pymupdf
except ImportError:
    try:
        import fitz as pymupdf
    except ImportError:
        pymupdf = None

try:
    import winocr
except ImportError:
    winocr = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


MONTH_MAP = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
}

ALLOWED_EVENT_TYPES = [
    'Hackathon', 'Symposium', 'Workshop', 'Sports',
    'Cultural Event', 'Internship', 'Competition', 'Seminar', 'Other'
]


class DocumentExtractionService:
    """
    Intelligent Dual Document OCR and Information Extraction Engine:
    - Extracts text from digital PDFs via PyMuPDF
    - Performs OCR on scanned PDFs and images via Native Windows OCR (winocr) or pytesseract
    - Classifies documents (OD Letter vs Event Poster)
    - Extracts structured event fields
    - Detects conflicts between documents (dates, venue, event name)
    - Assigns confidence metrics and prepares form-fill payload
    """

    @classmethod
    def run_image_ocr(cls, pil_img: Image.Image) -> str:
        """Run OCR on a PIL Image using Windows Native OCR or pytesseract."""
        if not pil_img:
            return ""

        # 1. Try Windows Native OCR (fast, accurate, built-in)
        if winocr is not None:
            try:
                ocr_res = winocr.recognize_pil_sync(pil_img, lang='en')
                if ocr_res and isinstance(ocr_res, dict):
                    if ocr_res.get('lines'):
                        line_texts = [l.get('text', '').strip() for l in ocr_res.get('lines') if l.get('text')]
                        if line_texts:
                            return "\n".join(line_texts).strip()
                    if ocr_res.get('text'):
                        return ocr_res['text'].strip()
            except Exception as e:
                pass

        # 2. Try pytesseract fallback
        if pytesseract is not None:
            try:
                text = pytesseract.image_to_string(pil_img)
                if text and text.strip():
                    return text.strip()
            except Exception:
                pass

        return ""

    @classmethod
    def extract_text_from_file(cls, file_bytes: bytes, filename: str) -> str:
        """Extract all textual content from a PDF or image file."""
        if not file_bytes:
            return ""

        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        extracted_text = ""

        # A. PDF Processing
        if ext == 'pdf' or file_bytes[:4] == b'%PDF':
            if pymupdf is not None:
                try:
                    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                    page_texts = []
                    for page in doc:
                        txt = page.get_text()
                        # If page text is very short, it's likely a scanned PDF page -> run OCR
                        if not txt or len(txt.strip()) < 40:
                            try:
                                pix = page.get_pixmap(dpi=150)
                                pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                                ocr_txt = cls.run_image_ocr(pil_img)
                                if ocr_txt:
                                    txt = ocr_txt
                            except Exception:
                                pass
                        if txt:
                            page_texts.append(txt)
                    doc.close()
                    extracted_text = "\n\n".join(page_texts).strip()
                except Exception as err:
                    print(f"[!] PyMuPDF extraction warning: {err}")

        # B. Image Processing (PNG, JPG, JPEG, WEBP)
        elif ext in {'png', 'jpg', 'jpeg', 'webp'}:
            try:
                pil_img = Image.open(io.BytesIO(file_bytes))
                extracted_text = cls.run_image_ocr(pil_img)
            except Exception as img_err:
                print(f"[!] Image OCR warning: {img_err}")

        # Fallback if text is still empty and it's a PDF
        if not extracted_text and (ext == 'pdf' or file_bytes[:4] == b'%PDF') and pymupdf is not None:
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    pix = page.get_pixmap(dpi=150)
                    pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    ocr_t = cls.run_image_ocr(pil_img)
                    if ocr_t:
                        extracted_text += "\n" + ocr_t
                doc.close()
            except Exception:
                pass

        return extracted_text.strip()

    @classmethod
    def classify_document(cls, text: str) -> Dict[str, Any]:
        """
        Classify document content as an OD Letter or Event Poster/Brochure.
        Returns detection scores and classification labels.
        """
        if not text:
            return {
                "detectedType": "Unknown Document",
                "confidence": 0.0,
                "isODLetter": False,
                "isPoster": False
            }

        t_lower = text.lower()

        od_letter_keywords = [
            "on duty", "on-duty", "od permission", "permission letter", "permission",
            "requisition for od", "bonafide", "leave of absence", "grant me od",
            "request for on-duty", "request for od", "head of the department",
            "department of", "hod", "class incharge", "mentor", "respected sir",
            "respected madam", "to the principal", "yours obediently", "yours faithfully",
            "reg. no", "roll no", "studying in", "b.tech", "b.e", "academic year"
        ]

        poster_keywords = [
            "presents", "proudly presents", "call for papers", "hackathon",
            "symposium", "workshop", "cash prize", "registration", "rules",
            "guidelines", "organizing committee", "chief guest", "keynote",
            "agenda", "events:", "rounds:", "poster", "brochure", "entry fee",
            "venue:", "contact:", "scanner", "qr code", "grand finale",
            "first prize", "second prize", "trophy", "certificate of participation"
        ]

        od_matches = sum(1 for kw in od_letter_keywords if kw in t_lower)
        poster_matches = sum(1 for kw in poster_keywords if kw in t_lower)

        # Strong OD indicators
        has_strong_od_indicator = any(
            k in t_lower for k in [
                "on duty", "on-duty", "od permission", "permission letter",
                "request for on-duty", "request for od", "grant me od", "requisition for od"
            ]
        )

        od_score = min(1.0, od_matches / 4.0)
        poster_score = min(1.0, poster_matches / 4.0)

        if has_strong_od_indicator or (od_score >= 0.5 and od_score >= poster_score):
            return {
                "detectedType": "OD Permission Letter",
                "confidence": round(max(0.70, od_score), 2),
                "isODLetter": True,
                "isPoster": False
            }
        elif poster_score >= 0.5:
            return {
                "detectedType": "Event Poster / Brochure",
                "confidence": round(poster_score, 2),
                "isODLetter": False,
                "isPoster": True
            }
        elif od_matches > 0:
            return {
                "detectedType": "OD Supporting Document",
                "confidence": 0.60,
                "isODLetter": True,
                "isPoster": False
            }
        else:
            return {
                "detectedType": "Event Document",
                "confidence": 0.50,
                "isODLetter": False,
                "isPoster": True
            }

    @classmethod
    def parse_single_date(cls, d_str: str) -> Optional[str]:
        """Convert varied date representations into YYYY-MM-DD."""
        if not d_str:
            return None
        d_clean = re.sub(r'(\d+)(?:st|nd|rd|th)', r'\1', d_str.strip(), flags=re.IGNORECASE)
        d_clean = re.sub(r'[,.]', '', d_clean).strip()

        formats = [
            "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
            "%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y"
        ]
        for fmt in formats:
            try:
                dt = datetime.strptime(d_clean, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
        return None

    @classmethod
    def extract_dates(cls, text: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract event start and end dates from text (returns (from_date, to_date))."""
        if not text:
            return None, None

        # 0. YYYY-MM-DD range: e.g. 2026-11-28 to 2026-11-29, or 2026/11/28 - 2026/11/29
        range_match_iso = re.search(
            r'(\b\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}\b)\s*(?:to|[-–]|t0|tO)\s*(\b\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}\b)',
            text, re.IGNORECASE
        )
        if range_match_iso:
            d1 = cls.parse_single_date(range_match_iso.group(1))
            d2 = cls.parse_single_date(range_match_iso.group(2))
            if d1 and d2:
                return (d1, d2) if d1 <= d2 else (d2, d1)

        # 1. Date range pattern: e.g. 15-11-2026 to 17-11-2026 or 15/11/2026 - 17/11/2026
        range_match = re.search(
            r'(\b\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b)\s*(?:to|[-–]|t0|tO)\s*(\b\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b)',
            text, re.IGNORECASE
        )
        if range_match:
            d1 = cls.parse_single_date(range_match.group(1))
            d2 = cls.parse_single_date(range_match.group(2))
            if d1 and d2:
                return (d1, d2) if d1 <= d2 else (d2, d1)

        # 2. Textual range: e.g. 15th to 17th November 2026
        txt_range = re.search(
            r'(\b\d{1,2}(?:st|nd|rd|th)?)\s*(?:to|[-–])\s*(\b\d{1,2}(?:st|nd|rd|th)?)\s+([A-Za-z]+)\s+(\d{4})\b',
            text, re.IGNORECASE
        )
        if txt_range:
            day1 = re.sub(r'\D', '', txt_range.group(1))
            day2 = re.sub(r'\D', '', txt_range.group(2))
            month_name = txt_range.group(3).lower()
            year = txt_range.group(4)
            if month_name in MONTH_MAP:
                m_num = MONTH_MAP[month_name]
                try:
                    d1 = f"{year}-{m_num:02d}-{int(day1):02d}"
                    d2 = f"{year}-{m_num:02d}-{int(day2):02d}"
                    return (d1, d2) if d1 <= d2 else (d2, d1)
                except Exception:
                    pass

        # 3. Format: November 15 - 17, 2026
        txt_range2 = re.search(
            r'([A-Za-z]+)\s+(\b\d{1,2}(?:st|nd|rd|th)?)\s*(?:to|[-–])\s*(\b\d{1,2}(?:st|nd|rd|th)?)[,\s]+(\d{4})\b',
            text, re.IGNORECASE
        )
        if txt_range2:
            month_name = txt_range2.group(1).lower()
            day1 = re.sub(r'\D', '', txt_range2.group(2))
            day2 = re.sub(r'\D', '', txt_range2.group(3))
            year = txt_range2.group(4)
            if month_name in MONTH_MAP:
                m_num = MONTH_MAP[month_name]
                try:
                    d1 = f"{year}-{m_num:02d}-{int(day1):02d}"
                    d2 = f"{year}-{m_num:02d}-{int(day2):02d}"
                    return (d1, d2) if d1 <= d2 else (d2, d1)
                except Exception:
                    pass

        # 4. Fallback: find all single dates in text
        all_dates = []
        for m in re.finditer(r'\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b', text):
            parsed = cls.parse_single_date(m.group(1))
            if parsed and parsed not in all_dates:
                all_dates.append(parsed)

        for m in re.finditer(r'\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+[,\s]+\d{4})\b', text):
            parsed = cls.parse_single_date(m.group(1))
            if parsed and parsed not in all_dates:
                all_dates.append(parsed)

        if all_dates:
            # If multiple dates found, pick the latest (or future) dates
            return (all_dates[-1], all_dates[-1])

        return None, None

    @classmethod
    def parse_single_time(cls, t_str: str) -> Optional[str]:
        """Convert 12-hour or 24-hour time string into HH:MM (24-hour)."""
        if not t_str:
            return None
        t_clean = t_str.strip().upper()
        is_pm = 'PM' in t_clean
        is_am = 'AM' in t_clean
        num_part = re.sub(r'[^\d:]', '', t_clean)
        if not num_part:
            return None

        if ':' in num_part:
            parts = num_part.split(':')
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        else:
            h = int(num_part)
            m = 0

        if is_pm and h < 12:
            h += 12
        elif is_am and h == 12:
            h = 0
        return f"{h:02d}:{m:02d}"

    @classmethod
    def extract_timings(cls, text: str) -> Tuple[str, str]:
        """Extract event start and end times (returns (from_time, to_time))."""
        if not text:
            return '09:00', '17:00'

        time_match = re.search(
            r'(\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:to|[-–])\s*(\b\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b',
            text, re.IGNORECASE
        )
        if time_match:
            t1 = cls.parse_single_time(time_match.group(1))
            t2 = cls.parse_single_time(time_match.group(2))
            if t1 and t2:
                return t1, t2

        return '09:00', '17:00'

    @classmethod
    def extract_event_name(cls, text: str) -> str:
        """Extract event name using labeling, headline inspection, or contextual patterns."""
        if not text:
            return ""

        # Pattern 1: Explicit label
        m = re.search(
            r'(?:event\s*(?:name)?|title|program(?:\s*name)?)\s*[:\-–]\s*([^\n\r,\.;]+)',
            text, re.IGNORECASE
        )
        if m:
            val = m.group(1).strip().strip('"\'')
            if len(val) >= 3:
                return val.splitlines()[0].strip()

        # Pattern 2: "presents \n <EVENT NAME>"
        m2 = re.search(
            r'(?:presents|proudly\s+presents)\s*[\n\r]+\s*([A-Z0-9\s\-_&]{3,60})',
            text, re.IGNORECASE
        )
        if m2:
            val = m2.group(1).splitlines()[0].strip()
            if len(val) >= 3 and not val.lower().startswith('theme'):
                return val

        # Pattern 3: Quoted after participate in / shortlisted for
        m3 = re.search(
            r'(?:participat(?:e|ing)\s+in|shortlisted\s+for|attending)\s+["“\']([^"”\'\n\r]{3,60})["”\']',
            text, re.IGNORECASE
        )
        if m3:
            return m3.group(1).splitlines()[0].strip()

        # Pattern 4: Prominent capitalized lines with event keywords
        for line in text.splitlines():
            line_clean = line.strip().strip('"\'')
            upper_line = line_clean.upper()
            if any(k in upper_line for k in ['HACKATHON', 'SYMPOSIUM', 'WORKSHOP', 'CONFERENCE', 'FEST', 'SUMMIT', 'COMPETITION']):
                if 5 <= len(line_clean) <= 60:
                    if not line_clean.lower().startswith(('subject', 'category', 'theme', 'date', 'venue', 'dear', 'to')):
                        return line_clean

        return ""

    @classmethod
    def extract_event_type(cls, text: str) -> str:
        """Extract event category matching allowed enum."""
        t_lower = (text or "").lower()
        if any(k in t_lower for k in ['hackathon', 'ideathon', 'makeathon', 'codeathon', 'datathon']):
            return 'Hackathon'
        if any(k in t_lower for k in ['symposium', 'paper presentation', 'tech fest']):
            return 'Symposium'
        if any(k in t_lower for k in ['workshop', 'hands-on', 'bootcamp', 'masterclass']):
            return 'Workshop'
        if any(k in t_lower for k in ['sports', 'tournament', 'championship', 'cricket', 'badminton', 'athletics', 'football']):
            return 'Sports'
        if any(k in t_lower for k in ['cultural', 'culturals', 'dance', 'music', 'drama', 'arts fest']):
            return 'Cultural Event'
        if any(k in t_lower for k in ['internship', 'industrial training']):
            return 'Internship'
        if any(k in t_lower for k in ['competition', 'contest', 'quiz', 'olympiad', 'challenge']):
            return 'Competition'
        if any(k in t_lower for k in ['seminar', 'webinar', 'conference', 'colloquium']):
            return 'Seminar'
        return 'Other'

    @classmethod
    def extract_organizer(cls, text: str) -> str:
        """Extract organizing college or organization."""
        if not text:
            return ""

        m = re.search(
            r'(?:organiz(?:ed|ing)\s+(?:by|institution|college|department)?|host(?:ed\s+by)?|conducted\s+by)\s*[:\-–]\s*([^\n\r,\.;]+?)(?=\s+(?:date|venue|time|location|category|theme)|\.|$)',
            text, re.IGNORECASE
        )
        if m:
            val = m.group(1).strip()
            if len(val) >= 3:
                return val.splitlines()[0].strip()

        m2 = re.search(
            r'\b([A-Z][A-Za-z\s&]{2,45}(?:College|Institute|University|Campus|School of\s+[A-Za-z]+))\b',
            text
        )
        if m2:
            return m2.group(1).strip()

        return ""

    @classmethod
    def extract_venue(cls, text: str) -> str:
        """Extract event venue / location."""
        if not text:
            return ""

        m = re.search(
            r'(?:venue|location|place|held\s+at)\s*[:\-–]\s*([^\n\r;]+?)(?=\s+(?:date|time|theme|category|organizer|timing)|\.|$)',
            text, re.IGNORECASE
        )
        if m:
            val = m.group(1).strip()
            if len(val) >= 3:
                return val.splitlines()[0].strip()

        m2 = re.search(
            r'\b([A-Za-z0-9\s,\-_]+(?:Auditorium|Campus|Hall|Convention\s+Cent(?:er|re)|Seminar\s+Hall|Grounds?))\b',
            text, re.IGNORECASE
        )
        if m2:
            return m2.group(1).strip()

        return ""

    @classmethod
    def extract_fields_from_text(cls, text: str) -> Dict[str, Any]:
        """Extract all candidate fields from raw document text."""
        from_date, to_date = cls.extract_dates(text)
        from_time, to_time = cls.extract_timings(text)
        event_name = cls.extract_event_name(text)
        event_type = cls.extract_event_type(text)
        organizer = cls.extract_organizer(text)
        venue = cls.extract_venue(text)

        # Reason & Description
        m_reason = re.search(r'(?:reason|purpose)\s*[:\-–]\s*([^\n\r]+)', text, re.IGNORECASE)
        if m_reason:
            reason = m_reason.group(1).strip()
        elif event_name:
            reason = f"Participation in {event_name}"
        else:
            reason = ""

        description = ""
        if event_name and organizer:
            description = f"Attending {event_name} organized by {organizer} at {venue}." if venue else f"Attending {event_name} organized by {organizer}."

        return {
            "eventName": event_name,
            "eventType": event_type,
            "eventOrganizer": organizer,
            "venue": venue,
            "fromDate": from_date or "",
            "toDate": to_date or "",
            "fromTime": from_time or "09:00",
            "toTime": to_time or "17:00",
            "reason": reason,
            "description": description
        }

    @classmethod
    def compare_and_merge(
        cls,
        od_fields: Dict[str, Any],
        poster_fields: Dict[str, Any],
        od_text: str,
        poster_text: str,
        od_filename: str = "od_letter.pdf",
        poster_filename: str = "event_poster.png"
    ) -> Dict[str, Any]:
        """
        Compare extracted data from both documents, detect conflicts,
        assign confidence scores, and merge into final form-fill representation.
        """
        merged_extracted = {}
        field_confidence = {}
        conflicts = []

        # 1. Classification
        od_class = cls.classify_document(od_text)
        poster_class = cls.classify_document(poster_text)

        # Detect accidental swapping of files
        is_swapped = od_class.get("isPoster") and poster_class.get("isODLetter")
        if is_swapped:
            # Swap for extraction processing
            od_fields, poster_fields = poster_fields, od_fields

        fields_to_evaluate = [
            ("eventName", "Event Name"),
            ("eventType", "Event Type"),
            ("eventOrganizer", "Event Organizer / College"),
            ("venue", "Event Venue"),
            ("fromDate", "Event Start Date"),
            ("toDate", "Event End Date"),
            ("fromTime", "Start Time"),
            ("toTime", "End Time"),
            ("reason", "Reason for OD"),
            ("description", "Event Description")
        ]

        for field_key, field_label in fields_to_evaluate:
            od_val = (od_fields.get(field_key) or "").strip()
            poster_val = (poster_fields.get(field_key) or "").strip()

            # Case A: Both documents extracted a value
            if od_val and poster_val:
                is_conflict = False

                # Date comparison
                if field_key in ("fromDate", "toDate"):
                    if od_val != poster_val:
                        is_conflict = True
                        conflicts.append({
                            "field": field_key,
                            "label": field_label,
                            "odLetterValue": od_val,
                            "posterValue": poster_val,
                            "message": f"Date mismatch: OD Letter specifies '{od_val}' whereas Event Poster mentions '{poster_val}'."
                        })
                # Event Name & Venue comparison
                elif field_key in ("eventName", "venue", "eventOrganizer"):
                    norm_od = re.sub(r'[^a-zA-Z0-9]', '', od_val.lower())
                    norm_poster = re.sub(r'[^a-zA-Z0-9]', '', poster_val.lower())
                    similarity = difflib.SequenceMatcher(None, norm_od, norm_poster).ratio()
                    if similarity < 0.55 and not (norm_od in norm_poster or norm_poster in norm_od):
                        is_conflict = True
                        conflicts.append({
                            "field": field_key,
                            "label": field_label,
                            "odLetterValue": od_val,
                            "posterValue": poster_val,
                            "message": f"{field_label} mismatch: OD Letter specifies '{od_val}' while Event Poster mentions '{poster_val}'."
                        })

                if is_conflict:
                    field_confidence[field_key] = "low"
                    # Default selection: poster for event name/venue, OD letter for dates
                    merged_extracted[field_key] = od_val if field_key in ("fromDate", "toDate") else (poster_val or od_val)
                else:
                    field_confidence[field_key] = "high"
                    # Prefer the more descriptive/complete string
                    merged_extracted[field_key] = poster_val if len(poster_val) > len(od_val) else od_val

            # Case B: Only OD Letter has the value
            elif od_val:
                merged_extracted[field_key] = od_val
                field_confidence[field_key] = "medium"

            # Case C: Only Poster has the value
            elif poster_val:
                merged_extracted[field_key] = poster_val
                field_confidence[field_key] = "medium"

            # Case D: Neither document has the value
            else:
                merged_extracted[field_key] = ""
                field_confidence[field_key] = "low"

        # Defaults for times if empty
        if not merged_extracted.get("fromTime"):
            merged_extracted["fromTime"] = "09:00"
        if not merged_extracted.get("toTime"):
            merged_extracted["toTime"] = "17:00"

        # Never invent missing information: if empty, leave blank
        # Reason fallback from eventName
        if not merged_extracted.get("reason") and merged_extracted.get("eventName"):
            merged_extracted["reason"] = f"Participation in {merged_extracted['eventName']}"

        return {
            "success": True,
            "extracted": merged_extracted,
            "fieldConfidence": field_confidence,
            "conflicts": conflicts,
            "documentClassification": {
                "odLetter": {
                    "valid": od_class.get("isODLetter", True),
                    "detectedType": od_class.get("detectedType", "OD Permission Letter"),
                    "confidence": od_class.get("confidence", 0.9)
                },
                "eventPoster": {
                    "valid": poster_class.get("isPoster", True),
                    "detectedType": poster_class.get("detectedType", "Event Poster / Brochure"),
                    "confidence": poster_class.get("confidence", 0.9)
                },
                "isSwapped": is_swapped
            },
            "odLetterSummary": {
                "fileName": od_filename,
                "characterCount": len(od_text),
                "hasText": bool(od_text.strip())
            },
            "posterSummary": {
                "fileName": poster_filename,
                "characterCount": len(poster_text),
                "hasText": bool(poster_text.strip())
            }
        }
