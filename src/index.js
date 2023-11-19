import { initializeI18next, updateContent } from "./locales/language.js";
import i18next from "i18next";

initializeI18next().then(() => {
	updateContent();
});

i18next.on("languageChanged", () => {
	updateContent();
});

// Language switch

document.getElementById("lang-switch").checked = i18next.language === "en";
document.getElementById("lang-switch").addEventListener("click", () => {
	const currentLanguage = i18next.language;
	const newLanguage = currentLanguage === "en" ? "it" : "en";
	i18next.changeLanguage(newLanguage);
});

// Nav open / close
const navElem = document.getElementById("nav");
document.getElementById("open-menu-btn").addEventListener("click", (e) => {
	navElem.classList.add("show-menu");
});
document.getElementById("close-menu-btn").addEventListener("click", () => {
	navElem.classList.remove("show-menu");
});
