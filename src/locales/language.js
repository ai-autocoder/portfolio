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
		"nav-blog": "nav.blog",
		"banner-name": "banner.name",
		"banner-title": "banner.title",
		"badge-stack": "banner.badges.stack",
		"badge-installs": "banner.badges.installs",
		"badge-location": "banner.badges.location",
		"hero-cta-projects": "banner.cta.projects",
		"hero-cta-contact": "banner.cta.contact",
		"about-title": "about.title",
		"about-text": "about.text",
		"tech-stack-title": "techStack.title",
		"tech-frontend-title": "techStack.categories.frontend.title",
		"tech-backend-title": "techStack.categories.backend.title",
		"tech-devops-title": "techStack.categories.devops.title",
		"tech-other-title": "techStack.categories.other.title",
		"extensions-title": "extensions.title",
		"extensions-subtitle": "extensions.subtitle",
		"stat-downloads": "extensions.stats.downloads",
		"stat-opensource": "extensions.stats.openSource",
		"stat-registries": "extensions.stats.registries",
		"stat-extensions": "extensions.stats.extensions",
		"extensions-cta-text": "extensions.cta",
		"extensions-cta-marketplace": "aria-label.attribute.extensions.ctaMarketplaceAria",
		"extensions-cta-openvsx": "aria-label.attribute.extensions.ctaOpenVsxAria",
		"projects-header": "projects.header",
		"project-todo-img": "alt.attribute.projects.todo.img",
		"project-todo-title": "projects.todo.title",
		"project-todo-description": "projects.todo.description",
		"project-todo-posts-label": "projects.postsLabel",
		"project-todo-post-auth": "projects.todo.posts.auth",
		"project-todo-post-merge": "projects.todo.posts.merge",
		"project-todo-post-mcp": "projects.todo.posts.mcp",
		"project-todo-post-builds": "projects.todo.posts.builds",
		"project-todo-live": ["projects.links.liveApp", "aria-label.attribute.projects.todo.aria.live"],
		"project-todo-github": "aria-label.attribute.projects.todo.aria.github",
		"project-todo-marketplace": "aria-label.attribute.projects.todo.aria.marketplace",
		"project-cargocrew-img": "alt.attribute.projects.cargocrew.img",
		"project-cargocrew-title": "projects.cargocrew.title",
		"project-cargocrew-description": "projects.cargocrew.description",
		"project-cargocrew-live": ["projects.links.viewLive", "aria-label.attribute.projects.cargocrew.aria.live"],
		"project-lastlog-img": "alt.attribute.projects.lastlog.img",
		"project-lastlog-title": "projects.lastlog.title",
		"project-lastlog-description": "projects.lastlog.description",
		"project-lastlog-marketplace": "aria-label.attribute.projects.lastlog.aria.marketplace",
		"project-lastlog-github": "aria-label.attribute.projects.lastlog.aria.github",
		"project-xmldiff-img": "alt.attribute.projects.xmldiff.img",
		"project-xmldiff-title": "projects.xmldiff.title",
		"project-xmldiff-description": "projects.xmldiff.description",
		"project-xmldiff-marketplace": "aria-label.attribute.projects.xmldiff.aria.marketplace",
		"project-xmldiff-github": "aria-label.attribute.projects.xmldiff.aria.github",
		"project-mpd-img": "alt.attribute.projects.mpd.img",
		"project-mpd-title": "projects.mpd.title",
		"project-mpd-description": "projects.mpd.description",
		"project-mpd-marketplace": "aria-label.attribute.projects.mpd.aria.marketplace",
		"project-mpd-github": "aria-label.attribute.projects.mpd.aria.github",
		"footer-title": "contact.title",
		"contact-direct-text": "contact.direct",
		"form-name": "placeholder.attribute.contact.form.name",
		"form-email": "placeholder.attribute.contact.form.email",
		"form-message": "placeholder.attribute.contact.form.message",
		"form-name-label": "contact.form.name",
		"form-email-label": "contact.form.email",
		"form-message-label": "contact.form.message",
		"form-send": ["contact.form.send", "aria-label.attribute.contact.form.sendAria"],
	};

	// A value may list several keys, e.g. an element's text and its aria-label
	for (const [elementId, translationKeys] of Object.entries(elementsToUpdate)) {
		for (const translationKey of [].concat(translationKeys)) {
			updateElementContent(elementId, translationKey);
		}
	}
}

export function setupLanguageSwitch() {
	document.getElementById("lang-switch").checked =
		i18next.language.startsWith("en");
	syncHtmlLang();

	document.getElementById("lang-switch").addEventListener("click", () => {
		const newLanguage = i18next.language.startsWith("en") ? "it" : "en";
		i18next.changeLanguage(newLanguage);
	});

	i18next.on("languageChanged", () => {
		syncHtmlLang();
		updateContent();
	});
}

function syncHtmlLang() {
	document.documentElement.lang = i18next.language.startsWith("it")
		? "it"
		: "en";
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
