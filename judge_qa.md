# 🧠 Judge Q&A Cheat Sheet

Prepare yourself for these common questions from technical, medical, and business judges.

---

## 🛠️ Technical Questions

**Q: "How does the AI run in the browser without a backend?"**
- **A**: We use **ONNX Runtime Web**. We converted our PyTorch EfficientNetB3 model to ONNX format. It runs using **WebAssembly (WASM)** and WebGL/WebGPU acceleration, keeping all data on the device for 100% privacy and offline capability.

**Q: "What is the model size? Won't it slow down the page load?"**
- **A**: The model is optimized via quantization, bringing it down to **~35MB**. We use a **Service Worker (PWA)** to cache the model on the first load, so subsequent uses are instantaneous even without a network.

**Q: "How do you handle multi-device sync if you are offline-first?"**
- **A**: Data is stored in **IndexedDB**. When a connection is restored, we have a background sync process (demonstrated in Section 8) that pushes encrypted patient records to the central camp database.

---

## ⚕️ Medical Questions

**Q: "Is your model biased against different ethnic groups?"**
- **A**: We deliberately trained on the **APTOS 2019 dataset**, which was captured at Aravind Eye Hospital in India. Our model is specifically tuned for Indian retinal characteristics, unlike models trained on Western datasets.

**Q: "What happens if the image quality is poor?"**
- **A**: (Mention Section 9!) We implemented a **Heuristic Image Validator**. If the user uploads a blurry photo or something that isn't an eye, the app detects the lack of circular borders/color variance and prompts the user to retake the photo *before* running AI.

**Q: "Is 96% accuracy enough for a medical diagnosis?"**
- **A**: This tool is designed for **Triage**, not final surgery. It identifies patients who need urgent care from an ophthalmologist. Our **Sensitivity (94%+)** ensures we rarely miss a patient with a severe condition.

---

## 💼 Business Questions

**Q: "Why would the Government choose you over Google's ARDA?"**
- **A**: ARDA requires high-end fundus cameras and internet. RetinaScan AI works with **affordable smartphone-based lens attachments** (like Remidio) and functions in **zero-bandwidth** zones.

**Q: "What is your GTM (Go-To-Market) strategy?"**
- **A**: We target **NGOs** like Sankara Nethralaya first. They already run thousands of camps. By providing them with a free-to-use prototype and a ₹10/scan licensing fee, we bootstrap our data and credibility before pitching for state-level PHC integration.
