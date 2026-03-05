# 🎤 RetinaScan AI: Hackathon Demo Script

This script is designed for a **3-5 minute live demo**. It focuses on the "Hero Flow" and the unique technical differentiators (Offline AI + ABDM).

---

## ⏱️ 0:00 - 0:30 | The Hook (Problem)
- **Action**: Start on the **Dashboard** page.
- **Narrative**: 
  > "Diabetic Retinopathy is the leading cause of preventable blindness in India. In rural areas, there is only **1 eye specialist for every 100,000 people**. Patients travel hundreds of kilometers for a 5-minute screening. We built **RetinaScan AI** to bring that 5-minute screening directly to the village."

## ⏱️ 0:30 - 1:30 | The Power of Edge AI
- **Action**: Click **"New Scan"**. Enter a demo name (e.g., "Rahul Kumar"). 
- **Action**: Upload a retinal image (use one from `sample-data`). 
- **Key Moment**: Show the **Offline Indicator** (yellow badge) if you want to be bold—turn off your Wi-Fi!
- **Narrative**: 
  > "Most AI solutions require expensive cloud servers. We run our **EfficientNetB3** model entirely in the browser using **ONNX Runtime and WebAssembly**. This means we can screen patients in remote camps with **zero internet connectivity**."

## ⏱️ 1:30 - 2:30 | Trust & Integration
- **Action**: Scroll to the **Heatmap Overlay**. Toggle it on/off.
- **Narrative**: 
  > "AI shouldn't be a black box. Our **Grad-CAM visualization** highlights exactly where the AI sees lesions, building trust with the frontline health worker. Once the scan is done, we generate an elite medical report."
- **Action**: Click **"Generate PDF Report"**. Open the PDF.
- **Narrative**: 
  > "But we don't stop at the PDF. We integrate directly with the **Ayushman Bharat Digital Mission (ABDM)**. With one click, this report is linked to the patient's national **ABHA Health ID**."
- **Action**: Click **"Link to ABHA"** to show the success state.

## ⏱️ 2:30 - 3:00 | Scale & Impact
- **Action**: Navigate to **"Camp Stats"** then **"Business"**.
- **Narrative**: 
  > "Today, we've screened 14 patients in this camp alone. Our business model is a simple **₹10-per-scan** micro-transaction, making it affordable for every NGO and PHC in India. We aren't just building a model; we're building a scalable public health infrastructure."

## ⏱️ 3:00+ | Conclusion
- **Action**: End on the **Conclusion/Hero** section.
- **Narrative**: 
  > "RetinaScan AI: Saving sight, one village at a time. Thank you."
