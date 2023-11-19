import i18next from "i18next";
import i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "./en.json";
import itTranslation from "./it.json";

export function initializeI18next() {
	return i18next.use(i18nextBrowserLanguageDetector).init({
		debug: true,
		fallbackLng: "en",
		detection: {
			order: [
				"querystring",
				"cookie",
				"localStorage",
				"sessionStorage",
				"navigator",
				"htmlTag",
				"path",
				"subdomain",
			],
		},
		resources: {
			en: {
				translation: enTranslation,
			},
			it: {
				translation: itTranslation,
			},
		},
	});
}

export function updateContent() {
	document.getElementById("about").innerHTML = i18next.t("about", {
		what: "i18next",
	});
	document.getElementById("projects").innerHTML = i18next.t("projects", {
		what: "i18next",
	});
	document.getElementById("contact").innerHTML = i18next.t("contact", {
		what: "i18next",
	});
}
