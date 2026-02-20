export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-8 md:mt-12 py-4 md:py-6">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-600 gap-2">
        <span className="font-semibold">SIMplify</span>
        <div className="flex gap-4 md:gap-6">
          <a href="#" className="hover:text-gray-900">Support</a>
          <a href="#" className="hover:text-gray-900">Socials</a>
        </div>
      </div>
    </footer>
  );
}
