import Script from 'next/script';

export function TimeThemeScript() {
  return (
    <Script id="time-theme-script" strategy="beforeInteractive">
      {`
        (function() {
          try {
            var hours = new Date().getHours();
            var isDark = hours < 6 || hours >= 18;
            if (isDark) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch (e) {}
        })();
      `}
    </Script>
  );
}
