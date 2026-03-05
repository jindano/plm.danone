
# -*- coding: utf-8 -*-
import re
import sys
import tkinter as tk
from tkinter import filedialog, scrolledtext, messagebox
import pdfplumber

# 콘솔 출력 인코딩 문제 해결 (Windows CMD 대응)
sys.stdout.reconfigure(encoding="utf-8")

# PDF에서 텍스트 읽기 함수
def read_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                # 특수문자/깨짐 방지 → utf-8로 정리
                clean_text = page_text.encode("utf-8", errors="ignore").decode("utf-8")
                text += clean_text + "\n"
    return text

# 데이터 추출 함수
def extract_data():
    # 파일 선택 창 열기
    file_path = filedialog.askopenfilename(
        title="PDF 파일 선택",
        filetypes=[("PDF Files", "*.pdf")]
    )

    if not file_path:
        messagebox.showwarning("경고", "PDF 파일을 선택하세요!")
        return

    try:
        # PDF 텍스트 읽기
        text = read_pdf(file_path)

        # 추출용 정규표현식 패턴
        patterns = {
            "이름": r"이름:\s*(.+)",
            "생년월일": r"생년월일:\s*([\d-]+)",
            "연락처": r"연락처:\s*([\d-]+)",
            "이메일": r"이메일:\s*([\w\.-]+@[\w\.-]+)"
        }

        # 추출 결과 딕셔너리
        extracted_data = {}
        for field, pattern in patterns.items():
            match = re.search(pattern, text)
            if match:
                extracted_data[field] = match.group(1)

        # 출력 결과 표시
        output_box.delete("1.0", tk.END)  # 기존 내용 초기화
        if extracted_data:
            for key, value in extracted_data.items():
                output_box.insert(tk.END, f"{key}: {value}\n")
        else:
            output_box.insert(tk.END, "추출된 데이터가 없습니다.\n")

    except Exception as e:
        messagebox.showerror("에러", f"PDF 처리 중 문제가 발생했습니다:\n{e}")

# ----------------- UI 구성 -----------------
root = tk.Tk()
root.title("PDF 자동 양식 추출기")
root.geometry("500x400")

# 버튼: PDF 업로드 및 추출
upload_button = tk.Button(root, text="PDF 파일 선택 & 데이터 추출", command=extract_data)
upload_button.pack(pady=10)

# 출력 결과 박스
tk.Label(root, text="추출 결과:").pack()
output_box = scrolledtext.ScrolledText(root, width=60, height=15)
output_box.pack()

root.mainloop()
