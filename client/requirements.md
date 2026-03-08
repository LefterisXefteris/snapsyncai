## Packages
framer-motion | Smooth animations for drag-and-drop and list transitions
lucide-react | Beautiful icons for UI elements
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes
react-dropzone | Drag and drop file handling

## Notes
- The app uses a dark/light theme based on system preference or user toggle (defaulting to a rich dark theme for this "AI/Cyber" aesthetic).
- Images are uploaded via `POST /api/images/upload` as `FormData`.
- AI analysis happens on the backend during upload.
- We need to display the `aiData` JSON content in a readable way.
