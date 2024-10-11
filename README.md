# AIDE - Interactive Threaded Chat Interface

AIDE is a Next.js project that provides an interactive threaded chat interface, allowing power users to engage in advanced conversations with LLM models.

## Getting Started

To get started with the development server, run one of the following commands:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Features

- **Interactive Chat Interface**: Engage in threaded conversations with AI assistance.
- **Efficient UX Design**: Manage conversation structures with easy controls and accessibility.
- **Model Configuration**: Customize online or locally deployed LLM models for your responses.
- **Responsive Design**: Optimized for both desktop and mobile views.
- **SGLang support**: Utilize SGLang syntax abilities to power automatic tasks.

## Backend

The backend is powered by FastAPI, providing a robust and scalable API for handling chat requests and model configurations.

### Requirements

- Python 3.x
- FastAPI
- Uvicorn
- sglang
- OpenAI API Key

### Running the Backend

To start the FastAPI server, ensure you have the required dependencies installed and run:

```bash
npm run backend
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
