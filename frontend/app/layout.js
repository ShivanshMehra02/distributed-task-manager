import './globals.css';

export const metadata = {
  title: 'Task Manager',
  description: 'Real-Time Collaborative Task Manager',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
