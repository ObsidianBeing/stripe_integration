// src/app/page.tsx (or wherever you want your main donate button)
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to Our Charity</h1>
      <Link
        href="/donate"
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-lg text-lg transition duration-200"
      >
        Donate Now
      </Link>
    </main>
  );
}