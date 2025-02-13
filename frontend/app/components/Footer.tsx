'use client';

export default function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-medium mb-4">Study Space</h3>
            <p className="text-sm text-muted">
              Making it easy for students to find and book study spaces on campus.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-4">Quick Links</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="/about" className="text-muted hover:text-foreground transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="/contact" className="text-muted hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="/faq" className="text-muted hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm text-muted">
              <li>Email: support@studyspace.com</li>
              <li>Phone: (123) 456-7890</li>
            </ul>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted">
          <p>&copy; {new Date().getFullYear()} Study Space. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}