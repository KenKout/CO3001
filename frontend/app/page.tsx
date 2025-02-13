import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-grow">
      {/* Hero Section */}
      <section className="py-24 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6 text-balance">
              Find Your Perfect Study Space
            </h1>
            <p className="text-xl text-muted mb-8 text-balance">
              Book comfortable and quiet spaces across campus for your study sessions, group projects, or solo work.
            </p>
            <Link 
              href="/spaces"
              className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-8 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Find a Space
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Why Choose Study Space?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="group">
              <div className="mb-6 p-4 rounded-lg border bg-background transition-colors">
                <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-3">Easy Booking</h3>
              <p className="text-sm text-muted">Book your study space in seconds with our simple reservation system.</p>
            </div>
            <div className="group">
              <div className="mb-6 p-4 rounded-lg border bg-background transition-colors">
                <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-3">Various Spaces</h3>
              <p className="text-sm text-muted">Choose from individual desks, group rooms, or quiet zones.</p>
            </div>
            <div className="group">
              <div className="mb-6 p-4 rounded-lg border bg-background transition-colors">
                <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-3">Secure & Reliable</h3>
              <p className="text-sm text-muted">Guaranteed reservations with our reliable booking system.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Studying?</h2>
          <p className="text-xl text-muted mb-8">Join thousands of students who have found their perfect study space.</p>
          <Link 
            href="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-8 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Get Started Now
          </Link>
        </div>
      </section>
    </main>
  );
}
