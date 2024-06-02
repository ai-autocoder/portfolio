import Swiper from "swiper";
import {
	EffectCoverflow,
	Keyboard,
	Manipulation,
	Mousewheel,
	Navigation,
	Pagination,
	Scrollbar,
} from "swiper/modules";

export default function initializeSwiper() {
	new Swiper(".swiper", {
		modules: [
			Navigation,
			Pagination,
			Scrollbar,
			Keyboard,
			Mousewheel,
			Manipulation,
			EffectCoverflow,
		],
		direction: "horizontal",
		loop: false,
		slidesPerView: 1,
		spaceBetween: 100,
		centeredSlides: true,
		keyboard: true,
		grabCursor: true,
		followFinger: true,
		autoHeight: true,
		allowTouchMove: true,
		slideToClickedSlide: true,
		effect: "coverflow",
		coverflowEffect: {
			rotate: 30,
			stretch: 100,
			depth: 500,
			scale: 0.9,
			slideShadows: true,
		},
		pagination: {
			el: ".swiper-pagination",
			clickable: true,
		},
		navigation: {
			nextEl: ".swiper-button-next",
			prevEl: ".swiper-button-prev",
		},
	});
}
