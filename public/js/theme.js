document.addEventListener("alpine:init", () => {
  Alpine.store("theme", {
    dark: localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
    init() {
      this.apply();
    },
    apply() {
      if (this.dark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    darkTheme() {
      this.dark = true;
      localStorage.theme = "dark";
      this.apply();
    },
    lightTheme() {
      this.dark = false;
      localStorage.theme = "light";
      this.apply();
    },
  });
});
