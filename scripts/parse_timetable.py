import sys
import os
import json
import re

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def parse_extracted_table(table_data):
    # Standardize table cells (remove None, strip whitespace)
    clean_table = []
    for row in table_data:
        clean_row = [str(cell).strip() if cell is not None else "" for cell in row]
        # Only keep rows that have some content
        if any(clean_row):
            clean_table.append(clean_row)
            
    if not clean_table:
        return {"fallback": "image_fallback"}
        
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # 1. Identify which row is the headers (timings)
    header_row_idx = None
    time_regex = re.compile(r"(\d{1,2}[:.]\d{2})")
    
    for idx, row in enumerate(clean_table):
        # Count how many cells in this row look like times
        time_cells_count = sum(1 for cell in row if time_regex.search(cell))
        if time_cells_count >= 2:
            header_row_idx = idx
            break
            
    # Default header index to 0 if not found
    if header_row_idx is None:
        header_row_idx = 0
        
    headers = clean_table[header_row_idx]
    
    # Reconstruct start and end times for each column
    columns = []
    for i, header in enumerate(headers):
        times = time_regex.findall(header)
        # Clean up dots in times
        times = [t.replace(".", ":") for t in times]
        
        start_time = times[0] if len(times) > 0 else "00:00"
        end_time = times[1] if len(times) > 1 else (times[0] if len(times) > 0 else "00:00")
        
        # Standardize single digit hour: "9:00" -> "09:00"
        if start_time != "00:00" and len(start_time.split(":")[0]) == 1:
            start_time = "0" + start_time
        if end_time != "00:00" and len(end_time.split(":")[0]) == 1:
            end_time = "0" + end_time
            
        columns.append({
            "index": i,
            "startTime": start_time,
            "endTime": end_time
        })
        
    # 2. Extract schedule and subject mapping
    schedule = {day: [] for day in days_of_week}
    subjects_list = set()
    
    # Subject mapping detection (allocation of subjects table at the bottom)
    # Allocation format: CE0516 | Design and Analysis of Algorithms | DAA
    for row in clean_table:
        # Check if this row looks like a subject mapping row (e.g. CE0516, DAA)
        short_match = None
        for cell in row:
            # Look for 2-4 letter uppercase short codes
            match = re.search(r"\b([A-Z]{2,6})\b", cell)
            if match and cell not in ["LEC", "LAB", "ROOM", "CLASS", "TIME", "BREAK"]:
                short_match = match.group(1)
                
        # If it's a day row, parse schedule
        row_first_cell = row[0].strip()
        matched_day = None
        for day in days_of_week:
            if row_first_cell.lower() == day.lower() or (len(row_first_cell) > 4 and row_first_cell.lower().startswith(day.lower()[:5])):
                matched_day = day
                break
                
        if matched_day:
            for i, cell in enumerate(row):
                if i == 0 or i >= len(columns):
                    continue
                    
                cell_text = cell.strip()
                if not cell_text or cell_text.lower() in ["-", "break", "lunch", "recess", "free"]:
                    continue
                    
                col = columns[i]
                if col["startTime"] == "00:00":
                    continue
                    
                # Extract subject abbreviation from cell
                subj_candidates = re.findall(r"\b([A-Z]{2,6})\b", cell_text)
                subject = None
                for cand in subj_candidates:
                    if cand not in ["LEC", "LAB", "ROOM", "TO", "AMP", "BREAK"]:
                        subject = cand
                        break
                        
                if not subject and subj_candidates:
                    for cand in subj_candidates:
                        if cand not in ["TO", "BREAK"]:
                            subject = cand
                            break
                            
                if not subject:
                    continue
                    
                subjects_list.add(subject)
                
                # Extract room (e.g. LH-11, LAB-4)
                room_match = re.search(r"\b(LH-\d+|LAB-\d+-[A-Z]+|LH-B\d+|B\d+)\b", cell_text, re.IGNORECASE)
                room = room_match.group(1) if room_match else ""
                if not room:
                    paren_match = re.search(r"\(([^)]+)\)", cell_text)
                    if paren_match:
                        room = paren_match.group(1)
                        
                schedule[matched_day].append({
                    "subject": subject,
                    "startTime": col["startTime"],
                    "endTime": col["endTime"],
                    "room": room
                })
        elif short_match:
            # It's a subject allocation row, add the short match to subjects list
            subjects_list.add(short_match)
            
    # Clean up empty days
    schedule = {k: v for k, v in schedule.items() if len(v) > 0}
    
    if not schedule:
        return {"fallback": "image_fallback"}
        
    return {
        "subjects": sorted(list(subjects_list)),
        "schedule": schedule
    }

def parse_text_fallback(text):
    lines = text.split("\n")
    subjects = set()
    schedule = {}
    
    time_pattern = re.compile(r"(\d{1,2}[:.]\d{2})\s*(?:to|-)\s*(\d{1,2}[:.]\d{2})", re.IGNORECASE)
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    current_day = None
    for line in lines:
        for day in days_of_week:
            if day.lower() in line.lower():
                current_day = day
                if current_day not in schedule:
                    schedule[current_day] = []
                    
        if current_day:
            time_match = time_pattern.search(line)
            if time_match:
                start, end = time_match.groups()
                start = start.replace(".", ":")
                end = end.replace(".", ":")
                
                # Standardize single digit hour: "9:00" -> "09:00"
                if len(start.split(":")[0]) == 1:
                    start = "0" + start
                if len(end.split(":")[0]) == 1:
                    end = "0" + end
                    
                # Find any subject short names in this line
                # Look for uppercase abbreviations
                words = re.findall(r"\b[A-Z]{2,6}\b", line)
                subject = None
                for w in words:
                    if w not in ["LEC", "LAB", "ROOM", "CLASS", "TIME", "BREAK"]:
                        subject = w
                        subjects.add(w)
                        break
                        
                if subject:
                    room_match = re.search(r"LH-\d+|Lab-\d+|[A-Z]-\d+", line, re.IGNORECASE)
                    room = room_match.group(0) if room_match else ""
                    schedule[current_day].append({
                        "subject": subject,
                        "startTime": start,
                        "endTime": end,
                        "room": room
                    })
                    
    if not schedule:
        return {"fallback": "image_fallback"}
        
    return {
        "subjects": sorted(list(subjects)),
        "schedule": {k: v for k, v in schedule.items() if len(v) > 0}
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        return
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        return
        
    # Only run pdfplumber on PDFs
    ext = os.path.splitext(file_path)[1].lower()
    if ext != ".pdf":
        # Immediately return fallback for non-PDFs (images)
        print(json.dumps({"fallback": "image_fallback"}))
        return
        
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            if not pdf.pages:
                print(json.dumps({"fallback": "image_fallback"}))
                return
                
            page = pdf.pages[0]
            # Try structured table extraction first
            tables = page.extract_tables()
            if tables:
                result = parse_extracted_table(tables[0])
            else:
                # Try raw text extraction fallback
                text = page.extract_text() or ""
                if len(text.strip()) > 30:
                    result = parse_text_fallback(text)
                else:
                    result = {"fallback": "image_fallback"}
                    
            print(json.dumps(result, indent=2))
    except Exception as e:
        sys.stderr.write(f"PDF extraction error: {str(e)}\n")
        print(json.dumps({"fallback": "image_fallback", "error": str(e)}))

if __name__ == "__main__":
    main()
