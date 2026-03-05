import streamlit as st
import pandas as pd
from sklearn.linear_model import LinearRegression

st.set_page_config(page_title="Production Forecast", layout="wide")
st.title("Production Forecast Program")

# Sidebar
st.sidebar.header("File Upload")
uploaded_file = st.sidebar.file_uploader("Select Excel or CSV", type=['xlsx', 'xls', 'csv'])
use_sample = st.sidebar.button("Use Sample Data")

# Data
df = None

if use_sample:
    data = {
        'workers': [10, 12, 8, 15, 11, 14, 9, 13, 16, 10, 12, 15, 8, 14, 11],
        'hours': [8, 10, 6, 9, 8, 10, 7, 9, 11, 8, 9, 10, 6, 9, 8],
        'materials': [100, 120, 80, 150, 110, 140, 90, 130, 160, 100, 120, 150, 80, 140, 110],
        'production': [520, 680, 380, 820, 560, 780, 420, 700, 900, 500, 640, 800, 360, 760, 580]
    }
    df = pd.DataFrame(data)

if uploaded_file is not None:
    if uploaded_file.name.endswith('.csv'):
        df = pd.read_csv(uploaded_file)
    else:
        df = pd.read_excel(uploaded_file)
    df.columns = df.columns.str.strip()

# Main
if df is not None:
    st.subheader("Data Preview")
    st.dataframe(df)
    
    # Get column names
    cols = list(df.columns)
    st.write("Columns:", cols)
    
    if len(cols) >= 4:
        X = df[[cols[0], cols[1], cols[2]]]
        y = df[cols[3]]
        
        model = LinearRegression()
        model.fit(X, y)
        
        df['predicted'] = model.predict(X)
        accuracy = model.score(X, y)
        
        st.subheader("Model Accuracy")
        st.metric("Accuracy", "{:.1%}".format(accuracy))
        
        # Chart
        st.subheader("Chart")
        chart_data = pd.DataFrame({
            'Actual': df[cols[3]].tolist(),
            'Predicted': df['predicted'].tolist()
        })
        st.line_chart(chart_data)
        
        # Prediction
        st.subheader("Make Prediction")
        c1, c2, c3 = st.columns(3)
        v1 = c1.number_input(cols[0], value=10)
        v2 = c2.number_input(cols[1], value=8)
        v3 = c3.number_input(cols[2], value=100)
        
        if st.button("Predict"):
            result = model.predict([[v1, v2, v3]])[0]
            st.success("Predicted: {:.0f}".format(result))
else:
    st.info("Please upload a file or use sample data.")
