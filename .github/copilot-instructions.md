# Copilot Instructions for small100-onnx

## Project Overview
This project is for building a Capacitor plugin that runs offline on Android, iOS, and Web. The plugin downloads and uses ONNX models for translation tasks.

## Key Workflow
- On first app launch, fetch `version.txt` from [HuggingFace model repo](https://huggingface.co/lyphanthuc/small100-onnx/tree/main) to determine the latest model directory (e.g., `v1.0.0`).
- Download all required model files from the corresponding versioned directory:
  - `added_tokens.json`
  - `decoder_int8.onnx`
  - `encoder_int8.onnx`
  - `sentencepiece.bpe.model`
  - `special_tokens_map.json`
  - `tokenizer_config.json`
  - `vocab.json`
- The model supports translation. For example, sending "vi", "ja", or "Xin chào" should return a translated result.

## Architecture & Patterns
- The plugin must work offline after the initial download.
- Model versioning is handled via `version.txt` and directory structure on HuggingFace.
- All model files are required for correct operation; ensure atomic download and validation.
- The codebase is expected to include logic for HTTP(S) file download, ONNX model loading, and text translation.

## Conventions
- Use clear, descriptive commit messages for model or workflow changes.
- Place all plugin source code in a dedicated directory (e.g., `src/` or `plugin/`).
- Document any platform-specific logic (Android/iOS/Web) in code comments.

## Integration Points
- HuggingFace model repository: https://huggingface.co/lyphanthuc/small100-onnx/tree/main
- Capacitor plugin APIs for cross-platform support.

## Example Usage
- On app start, check and download the latest model files if not present.
- Use the plugin to translate text, e.g., `plugin.translate('Xin chào', 'vi', 'en')`.

## See Also
- `Plan.md` for the high-level project plan and workflow.

---
_If any part of this workflow changes, update this file to keep AI agents productive._
