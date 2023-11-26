import i18next from "i18next";
import i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "./en.json";
import itTranslation from "./it.json";

export function initializeI18next() {
	return i18next.use(i18nextBrowserLanguageDetector).init({
		debug: false,
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

function updateElementContent(id, key) {
	const element = document.getElementById(id);
	if (element) {
		if (key.includes(".attribute.")) {
			// Extract the attribute name and the actual translation key
			const [attrKey, translationKey] = key.split(".attribute.");
			const translation = i18next.t(translationKey);
			element.setAttribute(attrKey, translation);
		} else {
			const translation = i18next.t(key, { returnObjects: true });
			if (Array.isArray(translation)) {
				// Process multi line sections adding </br>
				element.innerHTML = translation.map((line) => `${line}</br>`).join("");
			} else {
				// If it's a string, use it directly
				element.innerHTML = translation;
			}
		}
	} else {
		console.warn(`Element with id '${id}' not found.`);
	}
}

export function updateContent() {
	const elementsToUpdate = {
		"nav-about": "nav.about",
		"nav-projects": "nav.projects",
		"nav-contact": "nav.contact",
		"banner-greeting": "banner.greeting",
		"banner-intro": "banner.intro",
		"banner-profession": "banner.profession",
		"about-title": "about.title",
		"about-text": "about.text",
		"projects-header": "projects.header",
		"footer-title": "contact.title",
		"form-name": "placeholder.attribute.contact.form.name",
		"form-message": "placeholder.attribute.contact.form.message",
		"form-send": "contact.form.send",
	};

	for (const [elementId, translationKey] of Object.entries(elementsToUpdate)) {
		updateElementContent(elementId, translationKey);
	}
}
