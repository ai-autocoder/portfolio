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

export function updateContent() {
	const elementsToUpdate = {
		"nav-about": "nav.about",
		"nav-projects": "nav.projects",
		"nav-contact": "nav.contact",
		"banner-name": "banner.name",
		"banner-title": "banner.title",
		"badge-tools": "banner.badges.tools",
		"badge-ai": "banner.badges.ai",
		"badge-enterprise": "banner.badges.enterprise",
		"about-title": "about.title",
		"about-text": "about.text",
		"services-title": "services.title",
		"service-1-title": "services.items.0.title",
		"service-1-description": "services.items.0.description",
		"service-2-title": "services.items.1.title",
		"service-2-description": "services.items.1.description",
		"service-3-title": "services.items.2.title",
		"service-3-description": "services.items.2.description",
		"service-4-title": "services.items.3.title",
		"service-4-description": "services.items.3.description",
		"tech-stack-title": "techStack.title",
		"tech-frontend-title": "techStack.categories.frontend.title",
		"tech-backend-title": "techStack.categories.backend.title",
		"tech-devops-title": "techStack.categories.devops.title",
		"tech-other-title": "techStack.categories.other.title",
		"extensions-title": "extensions.title",
		"extensions-subtitle": "extensions.subtitle",
		"stat-downloads": "extensions.stats.downloads",
		"stat-users": "extensions.stats.users",
		"stat-rating": "extensions.stats.rating",
		"stat-extensions": "extensions.stats.extensions",
		"extensions-cta-text": "extensions.cta",
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

export function setupLanguageSwitch() {
	document.getElementById("lang-switch").checked =
		i18next.language.startsWith("en");

	document.getElementById("lang-switch").addEventListener("click", () => {
		const newLanguage = i18next.language.startsWith("en") ? "it" : "en";
		i18next.changeLanguage(newLanguage);
	});

	i18next.on("languageChanged", () => {
		updateContent();
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
				// Process multi-line sections as separate paragraphs
				element.innerHTML = translation.map((line) => `<p>${line}</p>`).join("");
			} else {
				// If it's a string, use it directly
				element.innerHTML = translation;
			}
		}
	} else {
		console.warn(`Element with id '${id}' not found.`);
	}
}
