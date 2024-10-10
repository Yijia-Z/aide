# AIDE - Interactive Threaded Chat Interface

AIDE is a Next.js project that provides an interactive threaded chat interface, allowing users to engage in conversations with AI models. The project is bootstrapped with `create-next-app` and leverages various technologies and libraries to enhance user experience and functionality.

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
- **Model Configuration**: Customize AI models for your responses.
- **Responsive Design**: Optimized for both desktop and mobile views.
- **Font Optimization**: Uses `next/font` for automatic optimization and loading of custom Google Fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - An interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

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
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
