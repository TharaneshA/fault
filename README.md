# Fault.ai - Multi-modal Root Cause Analysis

Fault.ai is a state-of-the-art root cause analysis system for microservices, featuring:
- **INGD (Improved Neural Granger Discovery)**: Advanced causal inference.
- **CCRE (Causal Chain Reasoning Explanation)**: AI-powered explanations using Gemini.
- **Tauri + React**: A modern, cross-platform desktop experience.

## Prerequisites

- **Node.js**: 18.0+ (pnpm recommended)
- **Python**: 3.10+
- **Rust**: 1.70+ (for Tauri)
- **API Key**: A Google Gemini API Key.

## Setup Instructions

### 1. Frontend Setup
```bash
pnpm install
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
GEMINI_API_KEY=your_gemini_key_here
```

## Running the App (Development)

1. Start the backend:
```bash
cd backend
python main.py
```

2. Start the frontend:
```bash
pnpm dev
```

## Building the App (Production)

To create a standalone production bundle:

1. **Build the Backend Sidecar**:
```bash
cd backend
python build_exe.py
```
This script packages the Python backend into a binary located in `src-tauri/binaries/`.

2. **Build the Tauri Application**:
```bash
pnpm tauri build
```
The final installer will be available in `src-tauri/target/release/bundle/`.

## Verification

To verify your Gemini integration:
```bash
python backend/verify_env.py
python backend/test_live_gemini.py
```
