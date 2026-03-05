import pandas as pd
from sklearn.linear_model import LinearRegression
import matplotlib.pyplot as plt
from tkinter import Tk, filedialog

print("========================================")
print("    생산량 예측 프로그램 (그래프 버전)")
print("========================================")
print()

# ========================================
# 1. 엑셀 파일 선택
# ========================================
print("엑셀 파일을 선택하세요...")
root = Tk()
root.withdraw()
파일경로 = filedialog.askopenfilename(
    title="엑셀 파일 선택",
    filetypes=[("Excel files", "*.xlsx *.xls"), ("CSV files", "*.csv")]
)
root.destroy()

if not 파일경로:
    print("파일을 선택하지 않았습니다.")
    input("엔터를 누르면 종료...")
    exit()

# ========================================
# 2. 데이터 불러오기
# ========================================
if 파일경로.endswith('.csv'):
    df = pd.read_csv(파일경로, encoding='utf-8')
else:
    df = pd.read_excel(파일경로)

print()
print("=== 불러온 데이터 ===")
print(df)
print()

# 컬럼명 공백 제거
df.columns = df.columns.str.strip()

print("=== 컬럼명 확인 ===")
print(list(df.columns))
print()

# ========================================
# 3. 모델 학습
# ========================================
try:
    X = df[['작업자수', '작업시간', '원자재량']]
    y = df['생산량']
except KeyError as e:
    print("오류: 컬럼명을 확인하세요!")
    print("필요한 컬럼: 작업자수, 작업시간, 원자재량, 생산량")
    print("현재 컬럼:", list(df.columns))
    input("엔터를 누르면 종료...")
    exit()

model = LinearRegression()
model.fit(X, y)

# 예측값 계산
예측값 = model.predict(X)
df['예측생산량'] = 예측값

정확도 = model.score(X, y)
print("모델 정확도: {:.1%}".format(정확도))
print()

# ========================================
# 4. 그래프 그리기 (한글 폰트 설정)
# ========================================
try:
    plt.rcParams['font.family'] = 'Malgun Gothic'
except:
    try:
        plt.rcParams['font.family'] = 'AppleGothic'
    except:
        pass

plt.rcParams['axes.unicode_minus'] = False

fig, axes = plt.subplots(2, 2, figsize=(12, 10))

# 그래프 1: 실제 vs 예측 비교
ax1 = axes[0, 0]
데이터수 = len(df)
x축 = list(range(데이터수))
x축_왼쪽 = [i - 0.2 for i in x축]
x축_오른쪽 = [i + 0.2 for i in x축]

ax1.bar(x축_왼쪽, df['생산량'].tolist(), width=0.4, label='실제 생산량', color='blue')
ax1.bar(x축_오른쪽, df['예측생산량'].tolist(), width=0.4, label='예측 생산량', color='orange')
ax1.set_xlabel('데이터 번호')
ax1.set_ylabel('생산량')
ax1.set_title('실제 생산량 vs 예측 생산량')
ax1.legend()

# 그래프 2: 산점도 (정확도 확인)
ax2 = axes[0, 1]
ax2.scatter(df['생산량'].tolist(), df['예측생산량'].tolist(), color='green', s=100)
최소값 = float(df['생산량'].min())
최대값 = float(df['생산량'].max())
ax2.plot([최소값, 최대값], [최소값, 최대값], color='red', linestyle='--', label='완벽한 예측선')
ax2.set_xlabel('실제 생산량')
ax2.set_ylabel('예측 생산량')
ax2.set_title('예측 정확도 ({:.1%})'.format(정확도))
ax2.legend()

# 그래프 3: 작업자수와 생산량 관계
ax3 = axes[1, 0]
ax3.scatter(df['작업자수'].tolist(), df['생산량'].tolist(), color='purple', s=100)
ax3.set_xlabel('작업자수')
ax3.set_ylabel('생산량')
ax3.set_title('작업자수 vs 생산량')

# 그래프 4: 영향도 분석
ax4 = axes[1, 1]
영향도 = list(model.coef_)
항목 = ['작업자수', '작업시간', '원자재량']
colors = ['blue', 'green', 'orange']
ax4.bar(항목, 영향도, color=colors)
ax4.set_ylabel('영향도')
ax4.set_title('각 요소의 영향도')

for i, v in enumerate(영향도):
    ax4.text(i, v + 0.5, '{:.1f}'.format(v), ha='center', fontsize=12)

plt.tight_layout()

# 그래프 저장
try:
    plt.savefig('예측결과_그래프.png')
    print("그래프가 '예측결과_그래프.png'로 저장되었습니다.")
except:
    print("그래프 저장 실패")

plt.show()

# ========================================
# 5. 결과 요약
# ========================================
print()
print("========================================")
print("분석 결과 요약")
print("========================================")
print("작업자수 1명 증가 -> 생산량 {:.1f}개 증가".format(영향도[0]))
print("작업시간 1시간 증가 -> 생산량 {:.1f}개 증가".format(영향도[1]))
print("원자재량 1 증가 -> 생산량 {:.1f}개 증가".format(영향도[2]))
print()

input("엔터를 누르면 종료...")
