import React from "react";

const PageHeader = () => {
  const path = window.location.pathname;

  const navLink = (href, label) => {
    const active = path === href || (href !== '/' && path.startsWith(href));
    return (
      <a
        href={href}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition
          ${active
            ? 'bg-violet-700 text-white'
            : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
      >
        {label}
      </a>
    );
  };

  return (
    <header className="bg-gray-900 border-b border-white/10 px-6 h-14 flex items-center gap-6 shrink-0">
      <img src="/Experian-Logo.png" className="h-7 w-auto" alt="Experian" />
      <div className="w-px h-5 bg-white/20" />
      <nav className="flex gap-1">
        {navLink('/', 'Resumes')}
        {navLink('/job', 'Jobs')}
      </nav>
    </header>
  );
};

export default PageHeader;
