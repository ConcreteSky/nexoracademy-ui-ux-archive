(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));
  const MOCK_IMAGE_FALLBACKS = Object.freeze({
    "course-networking": {
      src: "assets/mock/CCNA.png",
      alt: "Şəbəkə texnologiyaları kursu üçün nümunəvi vizual",
    },
    "course-cybersecurity": {
      src: "assets/mock/CCNP.png",
      alt: "Kibertəhlükəsizlik kursu üçün nümunəvi vizual",
    },
    "course-cloud-devops": {
      src: "assets/mock/CCNA.png",
      alt: "Cloud və DevOps kursu üçün nümunəvi vizual",
    },
    "blog-networking": {
      src: "assets/mock/mock-blog-networking.svg",
      alt: "Şəbəkə texnologiyaları bloqu üçün nümunəvi vizual",
    },
    "blog-cybersecurity": {
      src: "assets/mock/mock-blog-cybersecurity.svg",
      alt: "Kibertəhlükəsizlik bloqu üçün nümunəvi vizual",
    },
    "blog-cloud-devops": {
      src: "assets/mock/mock-blog-cloud-devops.svg",
      alt: "Cloud və DevOps bloqu üçün nümunəvi vizual",
    },
    "academy-certification": {
      src: "assets/mock/mock-academy-certification.svg",
      alt: "IT sertifikasiyası üçün nümunəvi vizual",
    },
    "career-network-engineer": {
      src: "assets/mock/mock-career-network-engineer.svg",
      alt: "Şəbəkə mühəndisliyi karyerası üçün nümunəvi vizual",
    },
    "faq-networking-guide": {
      src: "assets/mock/mock-faq-networking-guide.svg",
      alt: "Şəbəkə sertifikasiyası bələdçisi üçün nümunəvi vizual",
    },
    "decoration-network-nodes": {
      src: "assets/mock/mock-decoration-network-nodes.svg",
      alt: "Şəbəkə qovşaqlarını göstərən dekorativ vizual",
    },
    "instructor-1": {
      src: "assets/nexora-portraits/nexora-team-01.jpg",
      alt: "İnstrüktor nümunəvi vizual",
    },
    "instructor-2": {
      src: "assets/nexora-portraits/nexora-team-02.jpg",
      alt: "İnstrüktor nümunəvi vizual",
    },
    "instructor-3": {
      src: "assets/nexora-portraits/nexora-team-03.jpg",
      alt: "İnstrüktor nümunəvi vizual",
    },
  });
  const apiBaseMeta = document.querySelector('meta[name="nexora-api-base"]')?.content;
  const apiBaseEnv = typeof window?.NEXORA_API_BASE !== "undefined" ? window.NEXORA_API_BASE : "";
  const API_BASE_URL = resolveApiBaseUrl(apiBaseMeta || apiBaseEnv);
  let pageController = null;

  function resolveApiBaseUrl(value) {
    const raw = String(value || "")
      .trim()
      .replace(/\/+$/, "");
    if (location.protocol === "file:") return raw;
    try {
      const configured = new URL(raw, location.href);
      const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
      if (
        loopback.has(configured.hostname) &&
        !loopback.has(location.hostname)
      ) {
        return location.origin.replace(/\/+$/, "");
      }
    } catch (_) {
      return location.origin.replace(/\/+$/, "");
    }
    return raw;
  }

  function applyDataImageFallbacks(root = document) {
    $$("img[data-image-fallback]", root).forEach((image) => {
      const fallback = MOCK_IMAGE_FALLBACKS[image.dataset.imageFallback];
      if (!fallback) return;
      const dataSource = safeCourseDetailUrl(image.dataset.imageSrc);
      const dataAlt = String(image.dataset.imageAlt || "").trim();
      const existingAlt = String(image.getAttribute("alt") || "").trim();

      if (dataSource) {
        image.addEventListener(
          "error",
          () => {
            image.src = fallback.src;
            image.alt = fallback.alt;
          },
          { once: true },
        );
        image.src = dataSource;
        image.alt = dataAlt || existingAlt || fallback.alt;
        return;
      }

      image.src = fallback.src;
      image.alt = fallback.alt;
    });
  }

  function announce(form, message, state = "success") {
    let node = $(".naic-form-message", form);
    if (!node) {
      node = document.createElement("p");
      node.className = "naic-form-message";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      form.appendChild(node);
    }
    node.dataset.state = state;
    node.textContent = message;
  }

  function clearInvalid(form) {
    $$(".naic-field-invalid", form).forEach((field) =>
      field.classList.remove("naic-field-invalid"),
    );
  }

  function markInvalid(field) {
    if (!field) return;
    field.classList.add("naic-field-invalid");
    field.addEventListener(
      "input",
      () => field.classList.remove("naic-field-invalid"),
      { once: true },
    );
  }

  function showLegacyFormError(form, error) {
    const aliases = {
      message: "letter",
    };
    Object.keys(error?.errors || {}).forEach((name) =>
      markInvalid(form.elements.namedItem(aliases[name] || name)),
    );
    announce(form, apiErrorMessage(error), "error");
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validPhone(value, required = false) {
    const phone = String(value || "").trim();
    if (!phone) return !required;
    const digits = phone.replace(/\D/g, "").length;
    return (
      phone.length <= 20 &&
      digits >= 7 &&
      digits <= 15 &&
      /^\+?\(?\d[\d ()-]*\d$/.test(phone)
    );
  }

  class ApiError extends Error {
    constructor(status, message, body = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
      this.errors =
        body?.errors && typeof body.errors === "object" ? body.errors : null;
    }
  }

  function apiErrorMessage(error) {
    if (error?.status === 429)
      return "Çox sayda cəhd edildi. Bir az sonra yenidən yoxlayın.";
    if (error?.status === 0)
      return "Serverlə əlaqə yaratmaq mümkün olmadı. Server tərəfinin işlədiyini və CORS ayarlarını yoxlayın.";
    if (error?.status === 401)
      return "Sessiya etibarsızdır. Yenidən daxil olun.";
    if (error?.status === 403) return "Bu əməliyyat üçün icazəniz yoxdur.";
    return error?.message || "Sorğu zamanı xəta baş verdi.";
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (
      options.body != null &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new ApiError(0, "Server tərəfi ilə əlaqə yaradılmadı.");
    }

    let body;
    if (response.status !== 204) {
      const raw = await response.text();
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (_) {
          body = { message: raw };
        }
      }
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        body?.message || response.statusText || "Sorğu uğursuz oldu.",
        body,
      );
    }
    return body;
  }

  const apiCache = new Map();
  const inflightCache = new Map();
  const CACHEABLE_PATHS = new Set(["/api/v1/public/catalog/categories"]);
  let courseCatalogPromise = null;
  const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  const PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:/i;
  const COURSE_CLOUD_REGEX = /cloud|bulud|devops/;
  const COURSE_CYBER_REGEX = /cyber|kiber|security|təhlükəsizlik/;
  let lastCategoryStateInput = null;
  let lastCategoryStateResult = null;

  async function cachedApiFetch(path, options = {}) {
    const cacheable =
      CACHEABLE_PATHS.has(path) || path.startsWith("/api/v1/public/content");
    if (!cacheable || options.body != null) {
      return apiFetch(path, options);
    }
    if (apiCache.has(path)) return apiCache.get(path);
    if (inflightCache.has(path)) return inflightCache.get(path);
    const promise = apiFetch(path, options).then(
      (result) => {
        apiCache.set(path, result);
        inflightCache.delete(path);
        return result;
      },
      (error) => {
        inflightCache.delete(path);
        throw error;
      },
    );
    inflightCache.set(path, promise);
    return promise;
  }

  function publicContentByKey(key, options = {}) {
    return cachedApiFetch(
      `/api/v1/public/content/${encodeURIComponent(key)}`,
      options,
    );
  }

  function publicContentByType(type, options = {}) {
    return cachedApiFetch(
      `/api/v1/public/content?type=${encodeURIComponent(type)}`,
      options,
    );
  }

  function setFormBusy(form, busy) {
    form.setAttribute("aria-busy", String(busy));
    $$('button[type="submit"]', form).forEach((button) => {
      button.disabled = busy;
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  const enumLabels = {
    BEGINNER: "Başlanğıc",
    INTERMEDIATE: "Orta",
    ADVANCED: "İrəli",
    ONLINE: "Onlayn",
    OFFLINE: "Əyani",
    HYBRID: "Hibrid",
  };

  function enumLabel(value) {
    return (
      enumLabels[value] ||
      String(value || "")
        .replaceAll("_", " ")
        .toLocaleLowerCase("az")
    );
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const months = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avqust",
      "sentyabr",
      "oktyabr",
      "noyabr",
      "dekabr",
    ];
    return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  const priceFormatterCache = new Map();
  function formatPrice(value, currency = "AZN") {
    if (value == null || value === "") return "Qiymət üçün müraciət et";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    const cur = currency || "AZN";
    try {
      let formatter = priceFormatterCache.get(cur);
      if (!formatter) {
        formatter = new Intl.NumberFormat("az-AZ", {
          style: "currency",
          currency: cur,
        });
        priceFormatterCache.set(cur, formatter);
      }
      return formatter.format(amount);
    } catch (_) {
      return `${amount} ${cur}`;
    }
  }

  async function initCourseMenus(signal, closeMobileMenu) {
    const desktopMenus = $$(".header__dropdown");
    const mobileCourseBodies = $$('.mobile-menu__accordion-item[type="button"]')
      .filter((button) => {
        const title = $(
          '[class*="menu__accordion__item__header__title"]',
          button,
        );
        return title?.textContent.replace(/\s+/g, " ").trim() === "Kurslar";
      })
      .map((button) => $('[class*="menu__accordion__item__body"]', button))
      .filter(Boolean);
    if (!desktopMenus.length && !mobileCourseBodies.length) return;

    try {
      const { courses } = await loadPublicCourseCatalog(signal);
      if (signal.aborted) return;
      const visibleCourses = courses.filter(
        (course) => course?.id && String(course.title || "").trim(),
      );
      const linkSpecs = visibleCourses.map((course) => ({
        href: `course-details.html?id=${encodeURIComponent(course.id)}`,
        text: course.title || "Adsız kurs",
      }));
      linkSpecs.push({ href: "courses.html", text: "Bütün kurslar" });

      function instantiateLinks(className) {
        return linkSpecs.map((spec) => {
          const link = document.createElement("a");
          if (className) link.className = className;
          link.href = spec.href;
          link.textContent = spec.text;
          return link;
        });
      }

      desktopMenus.forEach((menu) => {
        const categoryLinks = Array.from(menu.children).filter(
          (node) =>
            node.tagName === "A" &&
            node.getAttribute("href") === "categories.html",
        );
        const links = instantiateLinks("header__dropdown-item");
        menu.replaceChildren(...links);
        categoryLinks.forEach((link) => menu.append(link));
      });

      mobileCourseBodies.forEach((body) => {
        const categoryLinks = Array.from(body.children).filter(
          (node) =>
            node.tagName === "A" &&
            node.getAttribute("href") === "categories.html",
        );
        const links = instantiateLinks("");
        if (closeMobileMenu) {
          links.forEach((link) =>
            link.addEventListener("click", closeMobileMenu, { signal }),
          );
        }
        body.replaceChildren(...links);
        categoryLinks.forEach((link) => {
          if (closeMobileMenu)
            link.addEventListener("click", closeMobileMenu, { signal });
          body.append(link);
        });
      });
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      // Keep the static "Bütün kurslar" link as a resilient fallback.
    }
  }

  function initHeader(signal) {
    const header = $(".header");
    if (header) {
      const update = () =>
        header.classList.toggle("header--fixed", window.scrollY > 12);
      update();
      window.addEventListener("scroll", update, { passive: true, signal });
    }
    const mobileMenu = $(".mobile-menu");
    const menuButtons = $$(".header__menu__btn");
    let closeMobileMenu = null;
    if (mobileMenu && menuButtons.length) {
      const open = () => {
        mobileMenu.classList.add("mobile-menu--show");
        document.documentElement.classList.add("naic-menu-open");
        document.body.classList.add("naic-menu-open");
        menuButtons[0]?.setAttribute("aria-expanded", "true");
      };
      const close = () => {
        mobileMenu.classList.remove("mobile-menu--show");
        document.documentElement.classList.remove("naic-menu-open");
        document.body.classList.remove("naic-menu-open");
        menuButtons[0]?.setAttribute("aria-expanded", "false");
      };
      closeMobileMenu = close;
      menuButtons[0]?.setAttribute("aria-label", "Open menu");
      menuButtons[0]?.setAttribute("aria-expanded", "false");
      menuButtons[0]?.addEventListener("click", open, { signal });
      menuButtons[1]?.setAttribute("aria-label", "Close menu");
      menuButtons[1]?.addEventListener("click", close, { signal });
      $$("a", mobileMenu).forEach((a) =>
        a.addEventListener("click", close, { signal }),
      );
      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") close();
        },
        { signal },
      );
    }
    $$('.mobile-menu__accordion-item[type="button"]').forEach((button) => {
      const body = $('[class*="menu__accordion__item__body"]', button);
      if (!body) return;
      button.setAttribute("aria-expanded", "false");
      body.hidden = true;
      button.addEventListener(
        "click",
        () => {
          const expanded = button.getAttribute("aria-expanded") === "true";
          button.setAttribute("aria-expanded", String(!expanded));
          button.classList.toggle(
            "mobile-menu__accordion-item--active",
            !expanded,
          );
          body.hidden = expanded;
        },
        { signal },
      );
    });
    void initCourseMenus(signal, closeMobileMenu);
  }

  function initHeroMedia(signal) {
    const video = $(".hero-section__video");
    const playButton = $('[data-hero-control="playback"]');
    const hasSource = Boolean(
      video?.querySelector("source[src]") || video?.getAttribute("src"),
    );
    if (!video || !hasSource) {
      playButton?.setAttribute("aria-disabled", "true");
      return;
    }
    const icons = {
      play: '<path d="M8 5.75v12.5L18 12 8 5.75Z"></path>',
      pause:
        '<path d="M8 5V19M16 5V19" style="fill:none" stroke="var(--neutral-1)" stroke-linecap="round" stroke-width="2"></path>',
    };
    const setButtonIcon = (button, icon) => {
      const svg = $("svg", button);
      if (!svg) return;
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.innerHTML = icons[icon];
    };
    const syncPlaybackControl = () => {
      if (!playButton) return;
      const isPaused = video.paused || video.ended;
      playButton.dataset.mediaState = isPaused ? "paused" : "playing";
      playButton.setAttribute(
        "aria-label",
        isPaused ? "Videonu oynat" : "Videonu dayandır",
      );
      setButtonIcon(playButton, isPaused ? "play" : "pause");
    };
    playButton?.addEventListener(
      "click",
      async () => {
        try {
          if (video.paused) await video.play();
          else video.pause();
          syncPlaybackControl();
        } catch (_) {
          playButton.setAttribute("aria-disabled", "true");
        }
      },
      { signal },
    );
    ["play", "pause", "ended"].forEach((eventName) =>
      video.addEventListener(eventName, syncPlaybackControl, { signal }),
    );
    video.addEventListener(
      "loadedmetadata",
      () => {
        syncPlaybackControl();
      },
      { signal },
    );
    syncPlaybackControl();
  }

  function initHeroTypewriter(signal) {
    const TYPE_SPEED_MS = 80;
    const DELETE_SPEED_MS = 45;
    const HOLD_AFTER_TYPE_MS = 1700;
    const PAUSE_AFTER_DELETE_MS = 400;
    const START_DELAY_MS = 250;
    const title = $(".hero-section__title");
    const parts = title ? $$(":scope > span", title) : [];
    if (!title || parts.length !== 2) return;

    const pause = (delay) =>
      new Promise((resolve) => {
        if (signal.aborted) {
          resolve(false);
          return;
        }

        let settled = false;
        const finish = (completed) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", cancel);
          resolve(completed);
        };
        const timer = window.setTimeout(() => finish(true), delay);
        const cancel = () => {
          window.clearTimeout(timer);
          finish(false);
        };
        signal.addEventListener("abort", cancel, { once: true });
      });

    const run = async () => {
      if (signal.aborted) return;

      const originalParts = parts.map((part) =>
        part.textContent.replace(/\s+/g, " ").trim(),
      );
      if (originalParts.some((part) => !part)) return;

      const exactText = originalParts.join(" ");
      title.setAttribute("aria-label", exactText);
      parts.forEach((part) => {
        part.textContent = "";
        part.setAttribute("aria-hidden", "true");
      });
      const characters = originalParts.map((part) => Array.from(part));

      if (!(await pause(START_DELAY_MS))) return;

      while (!signal.aborted) {
        for (let partIndex = 0; partIndex < characters.length; partIndex += 1) {
          for (const character of characters[partIndex]) {
            if (signal.aborted) return;
            parts[partIndex].textContent += character;
            if (!(await pause(TYPE_SPEED_MS))) return;
          }
        }

        if (!(await pause(HOLD_AFTER_TYPE_MS))) return;

        for (
          let partIndex = characters.length - 1;
          partIndex >= 0;
          partIndex -= 1
        ) {
          while (parts[partIndex].textContent.length > 0) {
            if (signal.aborted) return;
            parts[partIndex].textContent = Array.from(
              parts[partIndex].textContent,
            )
              .slice(0, -1)
              .join("");
            if (!(await pause(DELETE_SPEED_MS))) return;
          }
        }

        if (!(await pause(PAUSE_AFTER_DELETE_MS))) return;
      }
    };

    void run();
  }

  function initApplicationForm(signal) {
    const form = $("form#applicationForm");
    if (!form) return;
    form.noValidate = true;
    const steps = $$(".application-form__step", form);
    if (steps.length < 2) return;
    const activeClass = "application-form__step--active";
    const next = $(".ai-form__step__btn-next", form);
    const back = steps[1].querySelector('button[type="button"]');

    const showStep = (index) => {
      steps.forEach((step, i) =>
        step.classList.toggle(activeClass, i === index),
      );
      steps[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    next?.addEventListener(
      "click",
      () => {
        const selected = $('input[name="applicationType"]:checked', form);
        if (!selected) {
          announce(form, "Davam etmək üçün müraciət məqsədini seçin.", "error");
          return;
        }
        announce(form, "", "success");
        showStep(1);
      },
      { signal },
    );
    back?.addEventListener("click", () => showStep(0), { signal });

    const file = $('input[name="cv"]', form);
    const fileLabel = file
      ? $(`label[for="${file.id}"] [class*="label-text"]`, form)
      : null;
    const fileLabelDefault = fileLabel?.textContent || "CV əlavə et";
    file?.addEventListener(
      "change",
      () => {
        if (file.files?.[0] && fileLabel)
          fileLabel.textContent = file.files[0].name;
      },
      { signal },
    );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();
        clearInvalid(form);
        const type = $('input[name="applicationType"]:checked', form);
        const fullname = $('input[name="fullname"]', form);
        const email = $('input[name="email"]', form);
        const phone = $('input[name="phone"]', form);
        const letter = $('[name="letter"]', form);
        const cv = $('input[name="cv"]', form);
        const invalid = [];
        if (!type) invalid.push(...$$('input[name="applicationType"]', form));
        if (!fullname?.value.trim()) invalid.push(fullname);
        if (!email?.value || !validEmail(email.value)) invalid.push(email);
        if (!phone?.value.trim() || !validPhone(phone.value, true)) invalid.push(phone);
        if (
          !letter?.value.trim() ||
          letter.value.trim().length < 50 ||
          letter.value.length > 2000
        )
          invalid.push(letter);
        const selectedFile = cv?.files?.[0];
        if (
          !selectedFile ||
          selectedFile.size > 10 * 1024 * 1024 ||
          !/\.(pdf|doc|docx)$/i.test(selectedFile.name)
        )
          invalid.push(cv);
        invalid.filter(Boolean).forEach(markInvalid);
        if (invalid.length) {
          announce(
            form,
            "Məlumatları yoxlayın: bütün xanalar, etibarlı e-poçt, ən azı 50 simvolluq motivasiya məktubu və 10 MB-dan kiçik PDF/Word CV tələb olunur.",
            "error",
          );
          return;
        }
        setFormBusy(form, true);
        try {
          const data = {
            applicationType: Number(type.value),
            fullname: fullname.value.trim(),
            email: email.value.trim(),
            phone: phone.value.trim(),
            letter: letter.value.trim(),
          };
          const body = new FormData();
          body.append(
            "data",
            new Blob([JSON.stringify(data)], { type: "application/json" }),
          );
          body.append("cv", selectedFile, selectedFile.name);
          await apiFetch("/api/v1/public/applications", {
            method: "POST",
            signal,
            body,
          });
          form.reset();
          if (fileLabel) fileLabel.textContent = fileLabelDefault;
          showStep(0);
          announce(form, "Müraciətiniz uğurla göndərildi.", "success");
        } catch (error) {
          if (error?.name !== "AbortError") showLegacyFormError(form, error);
        } finally {
          setFormBusy(form, false);
        }
      },
      { signal },
    );
  }

  function initSimpleForms(signal) {
    $$("form[data-form-kind]").forEach((form) => {
      form.noValidate = true;
      form.addEventListener(
        "submit",
        async (event) => {
          event.preventDefault();
          clearInvalid(form);
          const kind = form.dataset.formKind;
          const invalid = [];
          if (kind === "subscribe") {
            const email = $('input[name="email"]', form);
            if (!email?.value || !validEmail(email.value)) invalid.push(email);
          } else {
            $$("[required]", form).forEach((field) => {
              if (!field.value?.trim()) invalid.push(field);
            });
            const email = $('input[name="email"]', form);
            if (email && !validEmail(email.value)) invalid.push(email);
            const phone = $('input[name="phone"]', form);
            if (phone && !validPhone(phone.value, true)) invalid.push(phone);
            const letter = $('[name="letter"]', form);
            if (letter && letter.value.trim().length < 10) invalid.push(letter);
          }
          invalid.filter(Boolean).forEach(markInvalid);
          if (invalid.length) {
            announce(
              form,
              kind === "subscribe"
                ? "Etibarlı e-poçt ünvanı daxil edin."
                : "Bütün xanaları düzgün doldurun.",
              "error",
            );
            return;
          }
          if (kind === "subscribe") {
            const submit = $('button[type="submit"]', form);
            submit?.setAttribute("disabled", "disabled");
            form.setAttribute("aria-busy", "true");
            try {
              const email = form.elements.email.value.trim();
              await apiFetch("/api/v1/public/newsletter/subscriptions", {
                method: "POST",
                signal,
                body: JSON.stringify({
                  email,
                  consentVersion: "website-v1",
                }),
              });
              announce(form, "Abunəliyiniz uğurla qeydə alındı.", "success");
              form.reset();
            } catch (error) {
              if (error?.name !== "AbortError")
                showLegacyFormError(form, error);
            } finally {
              form.removeAttribute("aria-busy");
              submit?.removeAttribute("disabled");
            }
            return;
          }
          if (kind === "contact") {
            const submit = $('button[type="submit"]', form);
            const fullName = form.elements.full_name.value.trim();
            const email = form.elements.email.value.trim();
            const phone = form.elements.phone.value.trim();
            const note = form.elements.letter.value.trim();
            submit?.setAttribute("disabled", "disabled");
            form.setAttribute("aria-busy", "true");
            try {
              await apiFetch("/api/v1/public/contact-submissions", {
                method: "POST",
                signal,
                body: JSON.stringify({
                  fullName,
                  phone,
                  email,
                  message: note,
                }),
              });
              form.reset();
              announce(form, "Müraciətiniz uğurla göndərildi.", "success");
            } catch (error) {
              if (error?.name !== "AbortError")
                showLegacyFormError(form, error);
            } finally {
              form.removeAttribute("aria-busy");
              submit?.removeAttribute("disabled");
            }
          }
        },
        { signal },
      );
    });
  }

  function initVacancies(signal) {
    const input = $("#searchVacancies");
    if (!input) return;
    const tabs = $$(".vacancies__tab");
    const activeClass = "vacancies__tab--active";
    const cards = $$(".vacancy-card");
    const locale = "az";
    const filter = () => {
      const query = input.value.trim().toLocaleLowerCase(locale);
      const activeTab = tabs.find((tab) => tab.classList.contains(activeClass));
      const availableOnly = /mövcud|available/i.test(
        activeTab?.textContent || "",
      );
      cards.forEach((card) => {
        const matchesQuery = card.textContent
          .toLocaleLowerCase(locale)
          .includes(query);
        const matchesAvailability =
          !availableOnly || card.dataset.vacancyAvailable !== "false";
        card.hidden = !matchesQuery || !matchesAvailability;
      });
    };
    input.addEventListener("input", filter, { signal });
    tabs.forEach((tab) =>
      tab.addEventListener(
        "click",
        () => {
          tabs.forEach((x) => x.classList.remove(activeClass));
          tab.classList.add(activeClass);
          filter();
        },
        { signal },
      ),
    );
    filter();
  }

  function setupCoverflow(
    {
      containerSelector,
      prevSelector,
      nextSelector,
      depth = 220,
      centerFromLayout = false,
      autoplayMs = 0,
    },
    signal,
  ) {
    const container = $(containerSelector);
    if (!container) return;
    const wrapper = $(".swiper-wrapper", container);
    const slides = $$(".swiper-slide", container);
    if (!wrapper || !slides.length) return;
    let active = Math.max(
      0,
      slides.findIndex((slide) =>
        slide.classList.contains("swiper-slide-active"),
      ),
    );
    let currentOffset = 0;
    let autoplayTimer = null;
    let dragState = null;
    let cachedSlideWidth = slides[0]?.getBoundingClientRect().width || 315;
    let cachedMarginRight =
      parseFloat(getComputedStyle(slides[0]).marginRight) || 0;

    function measureLayout() {
      cachedSlideWidth = slides[0]?.getBoundingClientRect().width || 315;
      cachedMarginRight =
        parseFloat(getComputedStyle(slides[0]).marginRight) || 0;
    }

    function updateSlideClasses() {
      for (let i = 0; i < slides.length; i++) {
        const distance = i - active;
        const slide = slides[i];
        slide.classList.toggle("swiper-slide-active", distance === 0);
        slide.classList.toggle("swiper-slide-prev", distance === -1);
        slide.classList.toggle("swiper-slide-next", distance === 1);
        slide.classList.toggle(
          "swiper-slide-visible",
          Math.abs(distance) <= 2,
        );
      }
    }

    function computeOffset() {
      const containerWidth = container.clientWidth || window.innerWidth;
      const activeSlide = slides[active];
      return centerFromLayout
        ? containerWidth / 2 -
            ((activeSlide?.offsetLeft || 0) +
              (activeSlide?.offsetWidth || cachedSlideWidth) / 2)
        : containerWidth / 2 -
            cachedSlideWidth / 2 -
            active * (cachedSlideWidth + cachedMarginRight);
    }

    function render(animate = true) {
      updateSlideClasses();
      const offset = computeOffset();
      currentOffset = offset;
      wrapper.style.transition = animate ? "transform 480ms ease" : "none";
      wrapper.style.transform = `translate3d(${offset}px, 0, 0)`;
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const distance = i - active;
        slide.style.transition = animate
          ? "transform 480ms ease, opacity 480ms ease"
          : "none";
        slide.style.transform = `translate3d(${distance * -10}px, 0, ${-Math.abs(distance) * depth}px) scale(1)`;
        slide.style.zIndex = String(slides.length - Math.abs(distance));
        slide.style.opacity =
          Math.abs(distance) > 3 ? "0.25" : distance === 0 ? "1" : "0.55";
      }
    }
    function move(delta) {
      active = (active + delta + slides.length) % slides.length;
      render(true);
    }

    function stopAutoplay() {
      if (autoplayTimer === null) return;
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }

    function restartAutoplay() {
      stopAutoplay();
      autoplayTimer =
        autoplayMs > 0 && slides.length > 1
          ? window.setInterval(() => move(1), autoplayMs)
          : null;
    }

    function manualMove(delta) {
      dragState = null;
      move(delta);
      restartAutoplay();
    }

    function getRenderedOffset() {
      const transform = window.getComputedStyle(wrapper).transform;
      if (!transform || transform === "none") return currentOffset;
      const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
      if (matrix3d) {
        const values = matrix3d[1].split(",").map(Number);
        return Number.isFinite(values[12]) ? values[12] : currentOffset;
      }
      const matrix = transform.match(/^matrix\((.+)\)$/);
      if (matrix) {
        const values = matrix[1].split(",").map(Number);
        return Number.isFinite(values[4]) ? values[4] : currentOffset;
      }
      return currentOffset;
    }

    function getDragThreshold() {
      return Math.min(80, Math.max(45, cachedSlideWidth * 0.12));
    }

    function startDrag(clientX, clientY, inputType) {
      stopAutoplay();
      const baseOffset = getRenderedOffset();
      dragState = {
        inputType,
        startX: clientX,
        startY: clientY,
        lastX: clientX,
        axis: inputType === "mouse" ? "horizontal" : null,
        baseOffset,
      };
      wrapper.style.transition = "none";
      wrapper.style.transform = `translate3d(${baseOffset}px, 0, 0)`;
    }

    function updateDrag(clientX, clientY, event) {
      if (!dragState) return;
      const deltaX = clientX - dragState.startX;
      const deltaY = clientY - dragState.startY;
      if (dragState.axis === null && Math.hypot(deltaX, deltaY) >= 6) {
        dragState.axis =
          Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      dragState.lastX = clientX;
      if (dragState.axis !== "horizontal") return;
      event.preventDefault();
      wrapper.style.transform = `translate3d(${dragState.baseOffset + deltaX}px, 0, 0)`;
    }

    function finishDrag(clientX, allowSnap = true) {
      if (!dragState) return;
      const completedDrag = dragState;
      const endX = Number.isFinite(clientX) ? clientX : completedDrag.lastX;
      const deltaX = endX - completedDrag.startX;
      dragState = null;
      if (
        allowSnap &&
        completedDrag.axis === "horizontal" &&
        Math.abs(deltaX) >= getDragThreshold()
      ) {
        move(deltaX > 0 ? -1 : 1);
      } else {
        render(true);
      }
      restartAutoplay();
    }

    container.addEventListener(
      "mousedown",
      (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        startDrag(event.clientX, event.clientY, "mouse");
      },
      { signal },
    );
    window.addEventListener(
      "mousemove",
      (event) => {
        if (dragState?.inputType !== "mouse") return;
        updateDrag(event.clientX, event.clientY, event);
      },
      { signal },
    );
    window.addEventListener(
      "mouseup",
      (event) => {
        if (dragState?.inputType !== "mouse") return;
        finishDrag(event.clientX);
      },
      { signal },
    );
    container.addEventListener("dragstart", (event) => event.preventDefault(), {
      signal,
    });
    container.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        startDrag(touch.clientX, touch.clientY, "touch");
      },
      { signal, passive: true },
    );
    container.addEventListener(
      "touchmove",
      (event) => {
        if (dragState?.inputType !== "touch" || event.touches.length !== 1)
          return;
        const touch = event.touches[0];
        updateDrag(touch.clientX, touch.clientY, event);
      },
      { signal, passive: false },
    );
    container.addEventListener(
      "touchend",
      (event) => {
        if (dragState?.inputType !== "touch") return;
        finishDrag(event.changedTouches[0]?.clientX);
      },
      { signal, passive: true },
    );
    container.addEventListener(
      "touchcancel",
      () => {
        if (dragState?.inputType !== "touch") return;
        finishDrag(dragState.lastX, false);
      },
      { signal, passive: true },
    );
    window.addEventListener(
      "blur",
      () => {
        if (dragState?.inputType !== "mouse") return;
        finishDrag(dragState.lastX, false);
      },
      { signal },
    );
    window.addEventListener(
      "resize",
      (() => {
        let resizeTimer = null;
        return () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            dragState = null;
            measureLayout();
            render(false);
            restartAutoplay();
          }, 150);
        };
      })(),
      { signal },
    );
    signal?.addEventListener(
      "abort",
      () => {
        stopAutoplay();
      },
      { once: true },
    );
    $(prevSelector)?.addEventListener("click", () => manualMove(-1), {
      signal,
    });
    $(nextSelector)?.addEventListener("click", () => manualMove(1), {
      signal,
    });
    requestAnimationFrame(() => render(false));
    restartAutoplay();
  }

  function initSliders(signal) {
    const CAREER_SLIDER_AUTOPLAY_MS = 4500;
    setupCoverflow(
      {
        containerSelector: ".success-stories__swiper .swiper",
        prevSelector: ".success-stories__prev",
        nextSelector: ".success-stories__next",
        depth: 290,
        centerFromLayout: true,
        autoplayMs: CAREER_SLIDER_AUTOPLAY_MS,
      },
      signal,
    );
    setupCoverflow(
      {
        containerSelector: ".views-naic__swiper .swiper",
        prevSelector: ".views-naic__prev",
        nextSelector: ".views-naic__next",
        depth: 125,
        centerFromLayout: true,
        autoplayMs: CAREER_SLIDER_AUTOPLAY_MS,
      },
      signal,
    );
  }

  function faqSortOrder(item) {
    const direct = Number(item?.sortOrder);
    if (item?.sortOrder != null && Number.isFinite(direct)) return direct;
    const nested = Number(item?.data?.sort_order);
    return item?.data?.sort_order != null && Number.isFinite(nested)
      ? nested
      : Number.MAX_SAFE_INTEGER;
  }

  function renderFaqAccordion(items, signal) {
    const accordion = $(".faq-accordion");
    if (!accordion) return;
    accordion.innerHTML = items
      .map((item, index) => {
        const question = String(item?.title || "Sual");
        const answer = String(item?.body || "Cavab daha sonra əlavə ediləcək.");
        const id = `faq-answer-cms-${index + 1}`;
        return `<div class="faq-item">
          <button class="faq-question" type="button" aria-expanded="false" aria-controls="${id}">
            <span>${escapeHtml(question)}</span>
            <span class="faq-indicator" aria-hidden="true">⌄</span>
          </button>
          <div class="faq-answer" id="${id}"><div class="faq-answer__inner"><p>${escapeHtml(answer)}</p></div></div>
        </div>`;
      })
      .join("");
    initFaqAccordion(signal);
  }

  async function initFaqPage(signal) {
    const accordion = $(".faq-accordion");
    if (!accordion) return;
    accordion.setAttribute("aria-busy", "true");
    accordion.dataset.faqSource = "loading";

    try {
      const content = await publicContentByType("FAQ", { signal });
      if (!Array.isArray(content))
        throw new ApiError(0, "FAQ məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = content
        .filter(
          (item) => String(item?.type || "").toUpperCase() === "FAQ",
        )
        .sort(
          (left, right) =>
            faqSortOrder(left) - faqSortOrder(right) ||
            String(left?.key || "").localeCompare(String(right?.key || "")),
      );
      if (!items.length) {
        accordion.innerHTML = `<div class="Nexora_emptyState">
          <h3>FAQ tapılmadı</h3>
          <p>Hazırda dərc olunmuş sual-cavab mövcud deyil.</p>
        </div>`;
        accordion.dataset.faqSource = "api-empty";
        return;
      }
      renderFaqAccordion(items, signal);
      accordion.dataset.faqSource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      accordion.dataset.faqSource = "fallback";
    } finally {
      if (!signal.aborted) accordion.removeAttribute("aria-busy");
    }
  }

  const MAX_HOMEPAGE_NEWS = 4;

  function newsCard(item, index) {
    const key = String(item?.key || `news-${index + 1}`);
    const title = String(item?.title || "").trim() || "Xəbər";
    const body = String(item?.body || "").trim();
    const data = item?.data && typeof item.data === "object" ? item.data : {};
    const coverImage = safeCourseDetailUrl(data.cover_image_url);
    const fallbackKeys = ["blog-networking", "blog-cybersecurity", "blog-cloud-devops"];
    const fallbackKey = fallbackKeys[index % fallbackKeys.length];
    const fallback = MOCK_IMAGE_FALLBACKS[fallbackKey];
    const imgSrc = coverImage || fallback?.src || "";
    const imgAlt = coverImage ? title : fallback?.alt || title;
    return `<a class="blog-card" href="news-details.html?key=${encodeURIComponent(key)}">
      ${imgSrc ? `<div class="blog-card__media"><img alt="${escapeHtml(imgAlt)}" data-nimg="1" decoding="async" height="400" loading="lazy" width="400" ${coverImage ? `src="${escapeHtml(coverImage)}"` : `data-image-src="" data-image-fallback="${fallbackKey}"`} style="color: transparent" /></div>` : ""}
      <div class="blog-card__content">
        <h3 class="blog-card__title">${escapeHtml(title)}</h3>
        <p class="blog-card__desc">${escapeHtml(body.length > 160 ? body.slice(0, 160) + "…" : body) || "Xəbərin davamı üçün baxın."}</p>
      </div>
      <span aria-hidden="true" class="ai-btn ai-btn--icon ai-btn--blur ai-btn--sm blog-card__cta">
        <svg class="" fill="none" height="100%" stroke="#ffffff" viewbox="0 0 24 24" width="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18L18 6M18 6H10M18 6V14" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
        </svg>
      </span>
    </a>`;
  }

  function newsStateCard(title, description) {
    return `<div class="Nexora_emptyState" style="min-height:180px">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>`;
  }

  async function initNewsSection(signal) {
    const container = $("#newsSection");
    const status = $("#newsStatus");
    if (!container) return;
    container.setAttribute("aria-busy", "true");
    if (status) status.textContent = "Xəbərlər yüklənir…";

    try {
      const content = await publicContentByType("NEWS", { signal });
      if (!Array.isArray(content))
        throw new ApiError(0, "Xəbər məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = content
        .filter(
          (item) => String(item?.type || "").toUpperCase() === "NEWS",
        )
        .sort(
          (left, right) =>
            (Number(left?.sortOrder) || 0) - (Number(right?.sortOrder) || 0) ||
            String(left?.key || "").localeCompare(String(right?.key || "")),
        )
        .slice(0, MAX_HOMEPAGE_NEWS);
      if (!items.length) {
        container.innerHTML = newsStateCard(
          "Hələ elan yoxdur",
          "Yeni xəbərlər və elanlar burada yayımlanacaq.",
        );
        if (status) status.textContent = "";
        container.dataset.newsSource = "api-empty";
        return;
      }
      container.innerHTML = items.map((item, i) => newsCard(item, i)).join("");
      if (status) status.textContent = "";
      container.dataset.newsSource = "api";
      applyDataImageFallbacks(container);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      container.innerHTML = newsStateCard(
        "Xəbərlər yüklənə bilmədi",
        "Zəhmət olmasa bir az sonra yenidən yoxlayın.",
      );
      if (status) status.textContent = "";
      container.dataset.newsSource = "fallback";
    } finally {
      if (!signal.aborted) {
        container.removeAttribute("aria-busy");
      }
    }
  }

  async function initNewsPage(signal) {
    const grid = $("#newsGrid");
    if (!grid) return;
    grid.setAttribute("aria-busy", "true");

    try {
      const content = await publicContentByType("NEWS", { signal });
      if (!Array.isArray(content))
        throw new ApiError(0, "Xəbər məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = content
        .filter(
          (item) => String(item?.type || "").toUpperCase() === "NEWS",
        )
        .sort(
          (left, right) =>
            (Number(left?.sortOrder) || 0) - (Number(right?.sortOrder) || 0) ||
            String(left?.key || "").localeCompare(String(right?.key || "")),
        );
      if (!items.length) {
        grid.innerHTML = newsStateCard(
          "Hələ elan yoxdur",
          "Yeni xəbərlər və elanlar burada yayımlanacaq.",
        );
        grid.dataset.newsSource = "api-empty";
        return;
      }
      grid.innerHTML = items.map((item, i) => newsCard(item, i)).join("");
      grid.dataset.newsSource = "api";
      applyDataImageFallbacks(grid);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      grid.innerHTML = newsStateCard(
        "Xəbərlər yüklənə bilmədi",
        "Zəhmət olmasa bir az sonra yenidən yoxlayın.",
      );
      grid.dataset.newsSource = "fallback";
    } finally {
      if (!signal.aborted) grid.removeAttribute("aria-busy");
    }
  }

  function renderNewsDetails(item) {
    const title = String(item?.title || "Xəbər").trim();
    const body = String(item?.body || "").trim();
    const data = item?.data && typeof item.data === "object" ? item.data : {};
    const coverImage = safeCourseDetailUrl(data.cover_image_url);
    const date = formatDate(item?.updatedAt || item?.createdAt);
    const fallbackKeys = ["blog-networking", "blog-cybersecurity", "blog-cloud-devops"];
    const fallback = MOCK_IMAGE_FALLBACKS[fallbackKeys[0]];
    const imgSrc = coverImage || fallback?.src || "";
    const imgAlt = coverImage ? title : fallback?.alt || title;

    return `<article class="Nexora_courseDetailV2">
      <section class="Nexora_courseDetailV2__hero">
        <div class="Nexora_courseDetailV2__heroCopy">
          <p class="Nexora_eyebrow">Xəbər</p>
          <h1 class="Nexora_pageTitle">${escapeHtml(title)}</h1>
          ${date ? `<p class="Nexora_pageLead">${escapeHtml(date)}</p>` : ""}
        </div>
        ${imgSrc ? `<figure class="Nexora_courseDetailV2__visual">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(imgAlt)}" loading="lazy" />
        </figure>` : ""}
      </section>
      <div class="Nexora_courseDetailV2__contentLayout">
        <div class="Nexora_courseDetailV2__contentMain">
          <section class="Nexora_courseDetailV2__contentSection">
            <div class="Nexora_courseDetailV2__richText"><p>${escapeHtml(body)}</p></div>
          </section>
        </div>
      </div>
    </article>`;
  }

  async function initNewsDetailsPage(signal) {
    const container = $("#newsDetails");
    if (!container) return;
    const key = new URLSearchParams(location.search).get("key")?.trim() || "";
    if (!key) {
      container.innerHTML = `<div class="Nexora_emptyState">
        <h1>Xəbər seçilməyib</h1>
        <p>Xəbər siyahısından seçim edərək yenidən yoxlayın.</p>
      </div>`;
      return;
    }
    container.setAttribute("aria-busy", "true");
    try {
      const item = await publicContentByKey(key, { signal });
      if (!item || typeof item !== "object")
        throw new ApiError(404, "Xəbər tapılmadı.");
      if (signal.aborted) return;
      container.innerHTML = renderNewsDetails(item);
      if (item.title) document.title = `${item.title} | Nexora Academy`;
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      container.innerHTML = `<div class="Nexora_emptyState">
        <h1>Xəbər əlçatan deyil</h1>
        <p>Xəbər siyahısına qayıdaraq digər xəbərlərə baxın.</p>
      </div>`;
    } finally {
      if (!signal.aborted) container.removeAttribute("aria-busy");
    }
  }

  function academyMetric(value, suffix = "") {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return suffix && !text.endsWith(suffix) ? `${text}${suffix}` : text;
  }

  function setAcademyInstructorCount(root, value) {
    const heading = $(".section--work .section__header__title", root);
    const count = academyMetric(value, "+");
    if (!heading || !count) return;
    const leadingText = Array.from(heading.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
    if (leadingText) leadingText.textContent = `\n         ${count}\n         `;
  }

  function setAcademyHeroImage(root, value) {
    const image = $(".who-we-are__image img", root);
    const source = safeCourseDetailUrl(value);
    if (!image || !source) return;
    const fallback = image.currentSrc || image.getAttribute("src") || "";
    image.addEventListener(
      "error",
      () => {
        if (fallback) image.src = fallback;
      },
      { once: true },
    );
    image.src = source;
  }

  function applyAcademyContent(root, page) {
    const title = String(page?.title || "").trim();
    const body = String(page?.body || "").trim();
    const data = page?.data && typeof page.data === "object" ? page.data : {};
    const stats =
      data.stats && typeof data.stats === "object" ? data.stats : {};
    const breadcrumb = $(".navigate-section__current", root);
    const info = $(".who-we-are__info p", root);
    const infoTitle = info ? $("strong", info) : null;
    const statItems = $$(".who-we-are__stat", root);
    const statValues = [
      {
        count: academyMetric(stats.graduates, "+"),
        label: "Məzunlar",
      },
      {
        count: academyMetric(stats.employmentRate, "%"),
        label: "İlk 6 ayda işlə təminat",
      },
    ];

    if (breadcrumb && title) breadcrumb.textContent = title;
    if (info && body) {
      if (infoTitle && title) infoTitle.textContent = title;
      Array.from(info.childNodes)
        .filter((node) => node !== infoTitle)
        .forEach((node) => node.remove());
      info.append(document.createTextNode(` ${body}`));
    }
    statItems.forEach((item, index) => {
      const metric = statValues[index];
      if (!metric?.count) return;
      const count = $(".who-we-are__stat-count", item);
      const label = $(".who-we-are__stat-title", item);
      if (count) count.textContent = metric.count;
      if (label) label.textContent = metric.label;
    });
    setAcademyInstructorCount(root, stats.instructors);
    setAcademyHeroImage(root, data.heroImage);
    if (title) document.title = `${title} | Nexora Academy`;
  }

  async function initAcademyPage(signal) {
    const root = $(".main--about");
    if (!root) return;
    root.setAttribute("aria-busy", "true");
    root.dataset.academySource = "loading";
    try {
      let page = null;
      try {
        page = await publicContentByKey("page.about", { signal });
      } catch (_) {
        page = null;
      }
      if (!page || typeof page !== "object") {
        const homePage = await publicContentByKey("page.home", { signal });
        const homeData = contentObject(homePage?.data);
        const about = contentObject(homeData.about);
        const highlights = Array.isArray(about.highlights) ? about.highlights : [];
        page = {
          title: homePage?.title || "",
          body: about.description || "",
          data: {
            stats: {
              graduates: highlights[0]?.value || "",
              employmentRate: highlights[1]?.value || "",
              instructors: "",
            },
            heroImage: about.heroImage || "",
          },
        };
      }
      if (signal.aborted) return;
      applyAcademyContent(root, page);
      root.dataset.academySource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      root.dataset.academySource = "fallback";
    } finally {
      if (!signal.aborted) root.removeAttribute("aria-busy");
    }
  }

  function vacancyCard(template, item, index) {
    const card = template.cloneNode(true);
    const title = $(".vacancy-card__title", card);
    const description = $(".vacancy-card__desc", card);
    const data = contentObject(item?.data);
    const details = [data.department, data.location, data.employmentType]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const rawKey = String(item?.key || `vacancy-${index + 1}`);
    const key = rawKey.replace(/[^a-z0-9_-]+/gi, "-");

    card.hidden = false;
    card.id = key;
    card.dataset.vacancyAvailable = "true";
    card.setAttribute("data-summary-only", "true");
    card.setAttribute("data-target-fragment", key);
    card.href = `vacancy-details.html?key=${encodeURIComponent(rawKey)}`;
    if (title) title.textContent = String(item?.title || "Açıq vakansiya");
    if (description) {
      const base = String(item?.body || "Vakansiya haqqında məlumat.");
      description.textContent = details.length
        ? `${base} ${details.join(" · ")}`
        : base;
    }
    return card;
  }

  function vacancyStateCard(template, failed = false) {
    const card = template.cloneNode(true);
    const title = $(".vacancy-card__title", card);
    const description = $(".vacancy-card__desc", card);
    const button = $("button", card);
    card.hidden = false;
    card.removeAttribute("id");
    card.removeAttribute("href");
    card.removeAttribute("data-summary-only");
    card.removeAttribute("data-target-fragment");
    card.dataset.vacancyAvailable = "true";
    card.setAttribute("aria-disabled", "true");
    card.setAttribute("tabindex", "-1");
    if (title) title.textContent = failed ? "Vakansiyalar yüklənmədi" : "Açıq vakansiya yoxdur";
    if (description) {
      description.textContent = failed
        ? "Məlumatı yükləmək mümkün olmadı. Bir az sonra yenidən yoxlayın."
        : "Hazırda yayımlanmış açıq mövqe mövcud deyil.";
    }
    if (button) button.disabled = true;
    return card;
  }

  function refreshVacancyFilters(signal) {
    const current = $(".vacancies__search");
    if (!current) return;
    const replacement = current.cloneNode(true);
    current.replaceWith(replacement);
    initVacancies(signal);
  }

  async function initVacanciesPage(signal) {
    const grid = $(".vacancies__grid");
    if (!grid) return;
    const currentCards = $$(".vacancy-card", grid);
    const template = currentCards[0];
    if (!template) return;
    grid.setAttribute("aria-busy", "true");
    grid.dataset.vacanciesSource = "loading";
    try {
      const vacancies = await publicContentByType("VACANCY", { signal });
      if (!Array.isArray(vacancies))
        throw new ApiError(0, "Vakansiya məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      const items = [...vacancies].sort(
        (left, right) =>
          Number(left?.sortOrder ?? 0) - Number(right?.sortOrder ?? 0) ||
          String(left?.title || "").localeCompare(
            String(right?.title || ""),
            "az",
          ),
      );
      if (!items.length) {
        grid.replaceChildren(vacancyStateCard(template));
        grid.dataset.vacanciesSource = "api-empty";
        refreshVacancyFilters(signal);
        return;
      }
      grid.replaceChildren(
        ...items.map((item, index) => vacancyCard(template, item, index)),
      );
      grid.dataset.vacanciesSource = "api";
      refreshVacancyFilters(signal);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      grid.replaceChildren(vacancyStateCard(template, true));
      grid.dataset.vacanciesSource = "error";
      refreshVacancyFilters(signal);
    } finally {
      if (!signal.aborted) grid.removeAttribute("aria-busy");
    }
  }

  async function initVacancyDetailsPage(signal) {
    const container = $("#vacancyDetails");
    if (!container) return;
    const params = new URLSearchParams(location.search);
    const key = params.get("key");
    if (!key) {
      container.innerHTML = `<div class="Nexora_courseDetailV2__loading">
        <p class="Nexora_eyebrow">Nexora Academy</p>
        <h1>Vakansiya tapılmadı</h1>
        <p>Keçid parametri düzgün deyil.</p>
        <a class="ai-btn ai-btn--primary" href="career.html" style="margin-top:24px">Karyeraya qayıt</a>
      </div>`;
      return;
    }
    try {
      const item = await cachedApiFetch(
        `/api/v1/public/content/${encodeURIComponent(key)}`,
        { signal },
      );
      if (signal.aborted) return;
      const data = contentObject(item?.data);
      const details = [data.department, data.location, data.employmentType]
        .map((v) => String(v || "").trim())
        .filter(Boolean);
      const title = String(item?.title || "Açıq vakansiya");
      const body = String(item?.body || "");
      document.title = `${title} | Nexora Academy`;
      container.innerHTML = `<div class="Nexora_courseDetailV2">
        <p class="Nexora_eyebrow">Karyera</p>
        <h1 class="Nexora_courseDetailV2__title">${escapeHtml(title)}</h1>
        ${details.length ? `<div class="Nexora_courseDetailV2__meta">${details.map((d) => `<span>${escapeHtml(d)}</span>`).join(" · ")}</div>` : ""}
        <div class="Nexora_courseDetailV2__body" style="margin-top:32px">
          <div class="Nexora_courseDetailV2__desc" style="white-space:pre-line">${escapeHtml(body)}</div>
        </div>
        <div style="margin-top:40px;display:flex;gap:12px;flex-wrap:wrap">
          <a class="ai-btn ai-btn--primary" href="career.html">Digər vakansiyalar</a>
        </div>
      </div>`;
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      container.innerHTML = `<div class="Nexora_courseDetailV2__loading">
        <p class="Nexora_eyebrow">Nexora Academy</p>
        <h1>Vakansiya yüklənmədi</h1>
        <p>${escapeHtml(apiErrorMessage(error))}</p>
        <a class="ai-btn ai-btn--primary" href="career.html" style="margin-top:24px">Karyeraya qayıt</a>
      </div>`;
    }
  }

  function contentObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function replaceSplitHeading(heading, lead, accent, tail = "") {
    if (!heading) return;
    const leadText = String(lead || "").trim();
    const accentText = String(accent || "").trim();
    const tailText = String(tail || "").trim();
    if (!leadText && !accentText && !tailText) return;
    const previousHighlight = $(".ai-highlight", heading);
    const highlight = document.createElement("span");
    highlight.className = previousHighlight?.className || "ai-highlight";
    highlight.textContent = accentText;
    const nodes = [];
    if (leadText) nodes.push(document.createTextNode(`${leadText} `));
    if (accentText) nodes.push(highlight);
    if (tailText) nodes.push(document.createTextNode(` ${tailText}`));
    heading.replaceChildren(...nodes);
  }

  function replaceCareerHeading(heading, highlightClass, lead, accent, tail = "") {
    if (!heading) return;
    const leadText = String(lead || "").trim();
    const accentText = String(accent || "").trim();
    const tailText = String(tail || "").trim();
    if (!leadText && !accentText && !tailText) return;
    const highlight = document.createElement("span");
    highlight.className = highlightClass;
    highlight.textContent = accentText;
    const nodes = [];
    if (leadText) nodes.push(document.createTextNode(`${leadText} `));
    if (accentText) nodes.push(highlight);
    if (tailText) nodes.push(document.createTextNode(` ${tailText}`));
    heading.replaceChildren(...nodes);
  }

  function applyCareerContent(page) {
    const data = contentObject(page?.data);
    const hero = contentObject(data.hero);
    replaceCareerHeading(
      $(".career-hero__title"),
      "career-hero__highlight",
      hero.titleLead,
      hero.titleAccent,
      hero.titleTail,
    );
    const heroDescription = $(".career-hero__desc");
    if (heroDescription && String(hero.description || "").trim())
      heroDescription.textContent = String(hero.description).trim();
    const heroButton = $(".career-hero__btn");
    if (heroButton && String(hero.buttonLabel || "").trim())
      heroButton.textContent = String(hero.buttonLabel).trim();
    const heroButtonUrl = safeCourseDetailUrl(hero.buttonUrl);
    if (heroButton && heroButtonUrl) heroButton.setAttribute("href", heroButtonUrl);
    const heroImage = $(".career-hero__img");
    const heroImageUrl = safeCourseDetailUrl(hero.imageUrl);
    if (heroImage && heroImageUrl) heroImage.setAttribute("src", heroImageUrl);

    const journey = contentObject(data.journey);
    replaceSplitHeading(
      $(".section--works .section__header__title"),
      journey.titleLead,
      journey.titleAccent,
    );
    const journeyItems = Array.isArray(journey.items) ? journey.items : [];
    const journeyCards = $$(".career-works .service-card");
    journeyItems.forEach((entry, index) => {
      const item = contentObject(entry);
      const card = journeyCards[index];
      if (!card) return;
      const title = $(".service-card__title", card);
      const description = $(".service-card__desc", card);
      const image = $("img.service-card__icon", card);
      if (title && String(item.title || "").trim())
        title.textContent = String(item.title).trim();
      if (description && String(item.description || "").trim())
        description.textContent = String(item.description).trim();
      const imageUrl = safeCourseDetailUrl(item.imageUrl);
      if (image && imageUrl) {
        image.setAttribute("src", imageUrl);
        if (String(item.title || "").trim())
          image.setAttribute("alt", String(item.title).trim());
      }
    });

    const intro = contentObject(data.intro);
    replaceCareerHeading(
      $(".career__header-title"),
      "career__highlight",
      intro.titleLead,
      intro.titleAccent,
      intro.titleTail,
    );
    const paragraphs = Array.isArray(intro.paragraphs) ? intro.paragraphs : [];
    const paragraphNodes = $$(".career__info p");
    paragraphs.forEach((paragraph, index) => {
      const node = paragraphNodes[index];
      if (node && String(paragraph || "").trim())
        node.textContent = String(paragraph).trim();
    });
    const introImage = $(".career-parallax-image");
    const introImageUrl = safeCourseDetailUrl(intro.imageUrl);
    if (introImage && introImageUrl) introImage.setAttribute("src", introImageUrl);

    const vacancies = contentObject(data.vacancies);
    const vacanciesTitle = $(".section--vacancy .section__header__title");
    const vacanciesDescription = $(".section--vacancy .section__header__desc");
    if (vacanciesTitle && String(vacancies.title || "").trim())
      vacanciesTitle.textContent = String(vacancies.title).trim();
    if (vacanciesDescription && String(vacancies.description || "").trim())
      vacanciesDescription.textContent = String(vacancies.description).trim();
  }

  async function initCareerContent(signal) {
    const root = $(".main--career");
    if (!root) return null;
    root.setAttribute("aria-busy", "true");
    root.dataset.contentSource = "loading";
    try {
      const page = await publicContentByKey("page.career", { signal });
      if (!page || typeof page !== "object")
        throw new ApiError(0, "Karyera məlumatının formatı düzgün deyil.");
      if (signal.aborted) return null;
      applyCareerContent(page);
      root.dataset.contentSource = "api";
      return page;
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return null;
      root.dataset.contentSource = "fallback";
      return null;
    } finally {
      root.removeAttribute("aria-busy");
    }
  }

  function applyHomeContent(page) {
    const data = contentObject(page?.data);
    const hero = contentObject(data.hero);
    const titleParts = $$(".hero-section__title > span");
    if (titleParts[0] && String(hero.titleLead || "").trim())
      titleParts[0].textContent = String(hero.titleLead).trim();
    if (titleParts[1] && String(hero.titleAccent || "").trim())
      titleParts[1].textContent = String(hero.titleAccent).trim();

    const video = $(".hero-section__video");
    const videoUrl = safeCourseDetailUrl(hero.videoUrl);
    const posterUrl = safeCourseDetailUrl(hero.posterUrl);
    if (video) {
      const source = $("source", video);
      const currentSource = source?.getAttribute("src") || video.getAttribute("src") || "";
      if (videoUrl && videoUrl !== currentSource) {
        if (source) source.setAttribute("src", videoUrl);
        else video.setAttribute("src", videoUrl);
        video.load();
      }
      if (posterUrl) video.poster = posterUrl;
      else video.removeAttribute("poster");
    }

    const stats = Array.isArray(data.stats) ? data.stats : [];
    const statsRoot = $(".stat-section");
    if (statsRoot && stats.length) {
      statsRoot.innerHTML = stats
        .map((metric) => {
          const item = contentObject(metric);
          return `<div class="stat-section__item"><div class="stat-section__content"><span class="stat-section__count">${escapeHtml(item.value)}</span><span class="stat-section__title">${escapeHtml(item.label)}</span></div></div>`;
        })
        .join("");
    }

    const services = contentObject(data.services);
    replaceSplitHeading(
      $(".section--work .section__header__title"),
      services.titleLead,
      services.titleAccent,
      services.titleTail,
    );
    const serviceItems = Array.isArray(services.items) ? services.items : [];
    const serviceRoot = $(".service-section");
    if (serviceRoot && serviceItems.length) {
      serviceRoot.innerHTML = serviceItems
        .map((entry) => {
          const item = contentObject(entry);
          const imageUrl = safeCourseDetailUrl(item.imageUrl);
          return `<div class="service-card"><div class="service-card__container"><div class="service-card__content"><h3 class="service-card__title">${escapeHtml(item.title)}</h3><p class="service-card__desc">${escapeHtml(item.description)}</p></div>${imageUrl ? `<div class="service-card__icon"><img alt="${escapeHtml(item.title)}" class="service-card__icon" decoding="async" height="220" loading="lazy" src="${escapeHtml(imageUrl)}" width="220" /></div>` : ""}</div></div>`;
        })
        .join("");
    }

    const about = contentObject(data.about);
    replaceSplitHeading(
      $(".section--who-we-are .section__header__title"),
      about.titleLead,
      about.titleAccent,
    );
    const aboutText = $(".section--who-we-are .who-we-are__info p");
    if (aboutText && String(about.description || "").trim())
      aboutText.textContent = String(about.description).trim();
    const highlights = Array.isArray(about.highlights) ? about.highlights : [];
    const highlightNodes = $$(".section--who-we-are .who-we-are__stat");
    highlights.forEach((entry, index) => {
      const item = contentObject(entry);
      const node = highlightNodes[index];
      if (!node) return;
      const value = $(".who-we-are__stat-count", node);
      const label = $(".who-we-are__stat-title", node);
      if (value) value.textContent = String(item.value || "");
      if (label) label.textContent = String(item.label || "");
    });
    const team = Array.isArray(about.team) ? about.team : [];
    const teamRoot = $(".section--who-we-are .who-we-are__media");
    if (teamRoot && team.length) {
      teamRoot.innerHTML = team
        .map((entry) => {
          const member = contentObject(entry);
          const imageUrl = safeCourseDetailUrl(member.imageUrl);
          if (!imageUrl || !String(member.name || "").trim()) return "";
          const alt = `${String(member.name).trim()} — ${String(member.role || "Komanda üzvü").trim()} | Nexora Academy`;
          return `<div class="who-we-are__image"><img alt="${escapeHtml(alt)}" decoding="async" height="400" loading="lazy" src="${escapeHtml(imageUrl)}" width="400" /><div class="who-we-are__image-info"><span>${escapeHtml(member.name)}</span><span>${escapeHtml(member.role)}</span></div></div>`;
        })
        .join("");
    }

    const roadmap = contentObject(data.roadmap);
    const roadmapHeader = $$(".section--roadmap .section__header__content > p");
    replaceSplitHeading(roadmapHeader[0], roadmap.eyebrow, roadmap.title);
    if (roadmapHeader[1] && String(roadmap.description || "").trim())
      roadmapHeader[1].textContent = String(roadmap.description).trim();
    const roadmapItems = Array.isArray(roadmap.items) ? roadmap.items : [];
    const roadmapNodes = $$(".section--roadmap .roadmap__item");
    roadmapItems.forEach((entry, index) => {
      const item = contentObject(entry);
      const node = roadmapNodes[index];
      if (!node) return;
      const copy = $$(
        ".roadmap__header-text > span, .roadmap__dot-text-1 > span, .roadmap__dot-text-2 > span, .roadmap__dot-text-3 > span",
        node,
      );
      if (copy[0] && String(item.title || "").trim())
        copy[0].textContent = String(item.title).trim();
      if (copy[1] && String(item.description || "").trim())
        copy[1].textContent = String(item.description).trim();
    });

    const sections = contentObject(data.sections);
    replaceSplitHeading(
      $(".section--projects .section__header__title"),
      sections.coursesTitleLead,
      sections.coursesTitleAccent,
    );
    replaceSplitHeading(
      $(".section--blogs .section__header__title"),
      sections.newsTitleLead,
      sections.newsTitleAccent,
    );
    replaceSplitHeading(
      $(".section--application .section__header__title"),
      sections.applicationTitleLead,
      sections.applicationTitleAccent,
    );
    const newsletterTitle = $(".subscribe-section__title");
    if (newsletterTitle && String(sections.newsletterTitle || "").trim())
      newsletterTitle.textContent = String(sections.newsletterTitle).trim();
  }

  async function initHomeContent(signal) {
    const root = $(".hero-section");
    if (!root) return null;
    root.setAttribute("aria-busy", "true");
    root.dataset.contentSource = "loading";
    try {
      const page = await publicContentByKey("page.home", { signal });
      if (!page || typeof page !== "object")
        throw new ApiError(0, "Ana səhifə məlumatının formatı düzgün deyil.");
      if (signal.aborted) return null;
      applyHomeContent(page);
      root.dataset.contentSource = "api";
      return page;
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return null;
      root.dataset.contentSource = "fallback";
      return null;
    } finally {
      if (!signal.aborted) root.removeAttribute("aria-busy");
    }
  }

  function applySiteSettings(page) {
    const data = contentObject(page?.data);
    $$('[data-site-footer]').forEach((footer) => {
      const address = $(".footer__address a", footer);
      const phone = $('.footer__contacts a[href^="tel:"]', footer);
      const email = $('.footer__contacts a[href^="mailto:"]', footer);
      if (address && String(data.address || "").trim()) {
        address.textContent = String(data.address).trim();
        const addressUrl = safeCourseDetailUrl(data.addressUrl);
        if (addressUrl) address.href = addressUrl;
      }
      if (phone && String(data.phone || "").trim()) {
        const phoneText = String(data.phone).trim();
        phone.textContent = phoneText;
        phone.href = `tel:${phoneText.replace(/[^\d+]/g, "")}`;
      }
      if (email && String(data.email || "").trim()) {
        const emailText = String(data.email).trim();
        email.textContent = emailText;
        email.href = `mailto:${emailText}`;
      }

      const socialColumn = $$(".footer__column", footer).find(
        (column) => $(".footer__heading", column)?.textContent.trim() === "Sosial media",
      );
      const socialList = socialColumn ? $(".footer__menu-list", socialColumn) : null;
      const socials = Array.isArray(data.socials) ? data.socials : [];
      if (socialList && socials.length) {
        socialList.innerHTML = socials
          .map((entry) => {
            const social = contentObject(entry);
            const url = safeCourseDetailUrl(social.url);
            if (!url || !String(social.label || "").trim()) return "";
            return `<li><a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(social.label)}</a></li>`;
          })
          .join("");
      }
    });
  }

  async function initSiteSettings(signal) {
    if (!$('[data-site-footer]')) return;
    try {
      const page = await publicContentByKey("page.site-settings", { signal });
      if (signal.aborted || !page || typeof page !== "object") return;
      applySiteSettings(page);
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      // Static footer remains the resilient fallback.
    }
  }

  function applyContactContent(root, page) {
    const title = $(".contact-info__title", root);
    const items = $$(".contact-info__item", root);
    const data =
      page?.data && typeof page.data === "object" && !Array.isArray(page.data)
        ? page.data
        : {};
    const values = [data.phone, data.email, data.address];

    if (title && String(page?.title || "").trim())
      title.textContent = String(page.title).trim();
    values.forEach((value, index) => {
      const text = String(value || "").trim();
      const node = items[index]
        ? $(":scope > span:last-child", items[index])
        : null;
      if (node && text) node.textContent = text;
    });
  }

  async function initContactPage(signal) {
    const root = $(".contact-container");
    if (!root) return;
    root.setAttribute("aria-busy", "true");
    root.dataset.contactSource = "loading";
    try {
      const page = await publicContentByKey("page.contact", { signal });
      if (!page || typeof page !== "object")
        throw new ApiError(0, "Əlaqə məlumatının formatı düzgün deyil.");
      if (signal.aborted) return;
      applyContactContent(root, page);
      root.dataset.contactSource = "api";
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      root.dataset.contactSource = "fallback";
    } finally {
      if (!signal.aborted) root.removeAttribute("aria-busy");
    }
  }

  function initPhoneInputs(signal) {
    $$('input[name="phone"]').forEach((input) => {
      input.setAttribute("inputmode", "tel");
      input.setAttribute("autocomplete", "tel");
      input.addEventListener(
        "input",
        () => {
          input.value = input.value.replace(/[^0-9+()\-\s]/g, "").slice(0, 20);
        },
        { signal },
      );
    });
  }

  function publicCategoryState(categories) {
    if (categories === lastCategoryStateInput) return lastCategoryStateResult;
    const byId = new Map();
    (Array.isArray(categories) ? categories : []).forEach((category) => {
      if (category?.id != null) byId.set(String(category.id), category);
    });
    const memo = new Map();
    const visiting = new Set();
    const isPublic = (id) => {
      const key = String(id);
      if (memo.has(key)) return memo.get(key);
      if (visiting.has(key)) {
        memo.set(key, false);
        return false;
      }
      const category = byId.get(key);
      if (!category || category.active !== true) {
        memo.set(key, false);
        return false;
      }
      visiting.add(key);
      const parentId = category.parentId;
      const valid =
        parentId == null || parentId === ""
          ? true
          : byId.has(String(parentId)) && isPublic(parentId);
      visiting.delete(key);
      memo.set(key, valid);
      return valid;
    };
    const visible = [...byId.values()]
      .filter((category) => isPublic(category.id))
      .sort(
        (a, b) =>
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
          String(a.name || a.slug || "").localeCompare(
            String(b.name || b.slug || ""),
            "az",
          ),
      );
    const result = {
      byId,
      visible,
      visibleIds: new Set(visible.map((category) => String(category.id))),
    };
    lastCategoryStateInput = categories;
    lastCategoryStateResult = result;
    return result;
  }

  function publicDateAllows(value, boundary, now = Date.now()) {
    if (value == null || value === "") return true;
    const raw = String(value);
    const dateOnly = DATE_ONLY_REGEX.test(raw);
    const timestamp = Date.parse(
      dateOnly
        ? `${raw}${boundary === "until" ? "T23:59:59.999" : "T00:00:00"}`
        : raw,
    );
    if (!Number.isFinite(timestamp)) return false;
    return boundary === "until" ? timestamp >= now : timestamp <= now;
  }

  function isPublicCourse(course, visibleCategoryIds, now = Date.now()) {
    return Boolean(
      course &&
      course.published === true &&
      course.active === true &&
      course.archived === false &&
      visibleCategoryIds.has(String(course.categoryId)) &&
      publicDateAllows(course.validFrom, "from", now) &&
      publicDateAllows(course.validUntil, "until", now),
    );
  }

  function courseViewModel(course) {
    const content =
      course?.content &&
      typeof course.content === "object" &&
      !Array.isArray(course.content)
        ? course.content
        : {};
    return { ...content, ...(course || {}) };
  }

  function renderCourseCard(course, categoryNames) {
    course = courseViewModel(course);
    const category = categoryNames.get(String(course.categoryId)) || "Kurs";
    const title = course.title || "Adsız kurs";
    const description =
      course.shortDescription ||
      course.targetAudience ||
      "Ətraflı məlumat üçün kurs səhifəsinə keçin.";
    const duration = course.durationWeeks
      ? `${escapeHtml(course.durationWeeks)} həftə`
      : "";
    const courseFallback = courseMockFallback(course);
    const realImageUrl = safeCourseDetailUrl(course.imageUrl);
    const nameBasedPath = `assets/courses/${courseTitleToFile(title)}.svg`;
    const imageUrl = realImageUrl || nameBasedPath;
    const imageAlt = realImageUrl
      ? course.imageAlt || `${title} kursunun əsas vizualı`
      : `${title} kursunun əsas vizualı`;
    return `<article class="Nexora_courseCard">
      <div class="Nexora_courseCardTop">
        <span class="Nexora_badge">${escapeHtml(category)}</span>
        <span class="Nexora_coursePrice">${escapeHtml(formatPrice(course.basePrice, course.currency))}</span>
      </div>
      <img class="Nexora_courseCardImage" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(courseFallback.src)}';this.alt='${escapeHtml(courseFallback.alt)}'" />
      <div class="Nexora_courseCardBody">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="Nexora_courseMeta">
        <span>${escapeHtml(enumLabel(course.difficulty))}</span>
        <span>${escapeHtml(enumLabel(course.deliveryFormat))}</span>
        ${duration ? `<span>${duration}</span>` : ""}
      </div>
      <a class="ai-btn ai-btn--text" href="course-details.html?id=${encodeURIComponent(course.id || "")}">Ətraflı bax</a>
    </article>`;
  }

  function projectCourseStateCard(template, title, description, action = null) {
    const card = template.cloneNode(true);
    card.removeAttribute("id");
    $$("[id]", card).forEach((node) => node.removeAttribute("id"));
    const titleNode = $(".project-card__title", card);
    const descriptionNode = $(".project-card__desc", card);
    const link = $(".project-card__cta", card);
    const image = $("img", card);
    if (titleNode) titleNode.textContent = title;
    if (descriptionNode) descriptionNode.textContent = description;
    if (link) {
      link.removeAttribute("data-summary-only");
      link.removeAttribute("data-target-fragment");
      if (action) {
        link.href = action.href;
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
        const label = $("span", link);
        if (label) label.textContent = action.label;
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("tabindex", "-1");
      }
    }
    if (image) {
      const fallback = MOCK_IMAGE_FALLBACKS["course-networking"];
      image.removeAttribute("data-image-src");
      image.removeAttribute("data-image-fallback");
      image.src = fallback.src;
      image.alt = fallback.alt;
    }
    return card;
  }

  function projectCourseCard(template, course, categoryNames) {
    course = courseViewModel(course);
    const card = template.cloneNode(true);
    $$("[id]", card).forEach((node) => node.removeAttribute("id"));
    card.id = String(course.slug || course.id || "");
    const title = $(".project-card__title", card);
    const description = $(".project-card__desc", card);
    const link = $(".project-card__cta", card);
    const image = $("img", card);
    const categoryName = categoryNames.get(String(course.categoryId)) || "";
    const detailUrl = `course-details.html?id=${encodeURIComponent(course.id || "")}`;
    if (title) title.textContent = course.title || "Adsız kurs";
    if (description) {
      description.textContent =
        course.shortDescription ||
        course.targetAudience ||
        course.fullDescription ||
        "Ətraflı məlumat üçün kurs səhifəsinə keçin.";
    }
    if (link) {
      link.href = detailUrl;
      link.removeAttribute("data-summary-only");
      link.removeAttribute("data-target-fragment");
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      const label = $("span", link);
      if (label) label.textContent = "Kursa bax";
    }
    card.setAttribute("role", "link");
    card.setAttribute("tabIndex", "0");
    card.style.cursor = "pointer";
    card.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.target.closest("a")) return;
      event.preventDefault();
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        window.open(detailUrl, "_blank", "noopener");
      } else {
        window.location.assign(detailUrl);
      }
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.assign(detailUrl);
    });
    if (image) {
      const fallback = courseMockFallback({ ...course, categoryName });
      const realImageUrl = safeCourseDetailUrl(course.imageUrl);
      const nameBasedPath = `assets/courses/${courseTitleToFile(course.title || "")}.svg`;
      image.removeAttribute("data-image-src");
      image.removeAttribute("data-image-fallback");
      image.src = realImageUrl || nameBasedPath || fallback.src;
      image.alt = realImageUrl ? (course.imageAlt || `${course.title || "Kurs"} kursunun əsas vizualı`) : fallback.alt;
    }
    return card;
  }

  async function loadPublicCourseCatalog(signal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (courseCatalogPromise) return courseCatalogPromise;
    const work = async () => {
      const categories = await cachedApiFetch("/api/v1/public/catalog/categories", { signal });
      if (!Array.isArray(categories))
        throw new ApiError(0, "Kateqoriya məlumatı əlçatan deyil.");
      const categoryState = publicCategoryState(categories);
      const categoryNames = new Map(
        categoryState.visible.map((category) => [
          String(category.id),
          category.name || category.slug || String(category.id),
        ]),
      );
      const baseParams = new URLSearchParams({
        size: "100",
        sort: "title,asc",
        published: "true",
        active: "true",
      });
      const firstParams = new URLSearchParams(baseParams);
      firstParams.set("page", "0");
      const firstPage = await apiFetch(`/api/v1/public/catalog/courses?${firstParams}`, {
        signal,
      });
      const totalPages = Math.min(
        100,
        Math.max(1, Number.parseInt(firstPage?.totalPages, 10) || 1),
      );
      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => {
          const params = new URLSearchParams(baseParams);
          params.set("page", String(index + 1));
          return apiFetch(`/api/v1/public/catalog/courses?${params}`, { signal });
        }),
      );
      const courses = [firstPage, ...remainingPages]
        .flatMap((page) => (Array.isArray(page?.content) ? page.content : []))
        .filter((course) => isPublicCourse(course, categoryState.visibleIds));
      return { courses, categoryNames };
    };
    courseCatalogPromise = work()
      .then((result) => {
        courseCatalogPromise = null;
        return result;
      })
      .catch((error) => {
        courseCatalogPromise = null;
        throw error;
      });
    return courseCatalogPromise;
  }

  function featuredCourseTimestamp(course) {
    const timestamp = Date.parse(course?.updatedAt || course?.createdAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  async function initHomeFeaturedCourses(signal) {
    const container = $(".projects-section");
    if (!container) return;
    const template = $(".project-card", container);
    if (!template) return;

    container.setAttribute("aria-busy", "true");
    container.replaceChildren(
      projectCourseStateCard(
        template,
        "Kurslar yüklənir…",
        "Seçilmiş kurslar serverdən alınır.",
      ),
    );

    try {
      const { courses, categoryNames } = await loadPublicCourseCatalog(signal);
      if (signal.aborted) return;
      let preferredIds = [];
      try {
        const page = await publicContentByKey("page.home", { signal });
        const data = contentObject(page?.data);
        preferredIds = Array.isArray(data.featuredCourseIds)
          ? data.featuredCourseIds.map(String).slice(0, 3)
          : [];
      } catch (error) {
        if (error?.name === "AbortError" || signal.aborted) return;
      }

      let featuredCourses = preferredIds.length
        ? preferredIds
            .map((id) => courses.find((course) => String(course.id) === id))
            .filter(Boolean)
        : [];

      if (!featuredCourses.length) {
        featuredCourses = [];
        for (let i = 0; i < courses.length; i++) {
          const course = courses[i];
          let insertAt = 3;
          for (let j = 0; j < 3; j++) {
            if (j >= featuredCourses.length) {
              insertAt = j;
              break;
            }
            const tsDiff =
              featuredCourseTimestamp(course) -
              featuredCourseTimestamp(featuredCourses[j]);
            if (
              tsDiff > 0 ||
              (tsDiff === 0 &&
                String(course?.title || "").localeCompare(
                  String(featuredCourses[j]?.title || ""),
                  "az",
                ) < 0)
            ) {
              insertAt = j;
              break;
            }
          }
          if (insertAt < 3) featuredCourses.splice(insertAt, 0, course);
        }
      }
      if (!featuredCourses.length) {
        container.replaceChildren(
          projectCourseStateCard(
            template,
            "Seçilmiş kurs tapılmadı",
            "Hazırda göstərilə bilən aktiv kurs yoxdur.",
            { href: "courses.html", label: "Bütün kurslara bax" },
          ),
        );
        return;
      }
      container.replaceChildren(
        ...featuredCourses.map((course) =>
          projectCourseCard(template, course, categoryNames),
        ),
      );
    } catch (error) {
      if (error?.name === "AbortError" || signal.aborted) return;
      container.replaceChildren(
        projectCourseStateCard(
          template,
          "Kurslar hazırda əlçatan deyil",
          apiErrorMessage(error),
          { href: "courses.html", label: "Bütün kurslara bax" },
        ),
      );
    } finally {
      if (!signal.aborted) container.removeAttribute("aria-busy");
    }
  }

  function initProjectCoursesPage(signal) {
    const container = $(".projects-section--courses");
    if (!container) return;
    const template = $(".project-card", container);
    if (!template) return;
    container.setAttribute("aria-busy", "true");
    container.replaceChildren(
      projectCourseStateCard(
        template,
        "Kurslar yüklənir…",
        "Açıq kurslar serverdən alınır.",
      ),
    );
    loadPublicCourseCatalog(signal)
      .then(({ courses, categoryNames }) => {
        if (signal.aborted) return;
        if (!courses.length) {
          container.replaceChildren(
            projectCourseStateCard(
              template,
              "Açıq kurs tapılmadı",
              "Kurs kataloqunda hazırda göstərilə bilən aktiv kurs yoxdur.",
              { href: "categories.html", label: "Kateqoriyalara bax" },
            ),
          );
          return;
        }
        container.replaceChildren(
          ...courses.map((course) =>
            projectCourseCard(template, course, categoryNames),
          ),
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError" || signal.aborted) return;
        container.replaceChildren(
          projectCourseStateCard(
            template,
            "Kurslar hazırda əlçatan deyil",
            apiErrorMessage(error),
            { href: "courses.html", label: "Yenidən yoxla" },
          ),
        );
      })
      .finally(() => {
        if (!signal.aborted) container.removeAttribute("aria-busy");
      });
  }

  function renderCategoryCard(category, categoryState) {
    const parent = categoryState.byId.get(String(category.parentId));
    const parentText = parent
      ? `Üst kateqoriya: ${parent.name || parent.slug || parent.id}`
      : "Əsas kateqoriya";
    return `<article class="Nexora_courseCard">
      <div class="Nexora_courseCardBody">
        <h3>${escapeHtml(category.name || category.slug || "Kateqoriya")}</h3>
        <p>${escapeHtml(parentText)}</p>
      </div>
      <a class="ai-btn ai-btn--text" href="category.html?id=${encodeURIComponent(category.id)}">Kateqoriyaya bax</a>
    </article>`;
  }

  async function initCategoriesPage(signal) {
    const grid = $("#categoriesGrid");
    const status = $("#categoriesStatus");
    if (!grid || !status) return;
    try {
      const categories = await cachedApiFetch("/api/v1/public/catalog/categories", { signal });
      if (signal.aborted) return;
      const categoryState = publicCategoryState(categories);
      grid.innerHTML = categoryState.visible.length
        ? categoryState.visible
            .map((category) => renderCategoryCard(category, categoryState))
            .join("")
        : '<div class="Nexora_emptyState"><h3>Açıq kateqoriya yoxdur</h3><p>Kataloqu bir az sonra yenidən yoxlayın.</p></div>';
      status.textContent = `${categoryState.visible.length} açıq kateqoriya`;
      status.dataset.state = "success";
    } catch (error) {
      if (error?.name === "AbortError") return;
      grid.innerHTML =
        '<div class="Nexora_emptyState"><h3>Kateqoriyalar əlçatan deyil</h3><p>Məlumatları hazırda yükləmək mümkün olmadı.</p></div>';
      status.textContent = apiErrorMessage(error);
      status.dataset.state = "error";
    }
  }

  async function initCategoryPage(signal) {
    const details = $("#categoryDetails");
    const childrenContainer = $("#categoryChildren");
    const childrenStatus = $("#categoryChildrenStatus");
    const coursesContainer = $("#categoryCourses");
    const coursesStatus = $("#categoryCoursesStatus");
    if (
      !details ||
      !childrenContainer ||
      !childrenStatus ||
      !coursesContainer ||
      !coursesStatus
    )
      return;
    const categoryId =
      new URLSearchParams(location.search).get("id")?.trim() || "";
    if (!/^\d+$/.test(categoryId)) {
      details.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kateqoriya seçilməyib</h1><p>Kateqoriya kataloqundan seçim edin.</p></div>';
      return;
    }
    try {
      const [category, categories] = await Promise.all([
        apiFetch(`/api/v1/public/catalog/categories/${encodeURIComponent(categoryId)}`, {
          signal,
        }),
        cachedApiFetch("/api/v1/public/catalog/categories", { signal }),
      ]);
      if (signal.aborted) return;
      const categoryState = publicCategoryState(categories);
      if (
        !category ||
        String(category.id) !== categoryId ||
        !categoryState.visibleIds.has(categoryId)
      )
        throw new ApiError(404, "Kateqoriya əlçatan deyil.");
      const name = category.name || category.slug || "Kateqoriya";
      const parent = categoryState.byId.get(String(category.parentId));
      details.innerHTML = `<div class="section__header__content">
        <p class="Nexora_eyebrow">${escapeHtml(parent?.name || "Kurs kataloqu")}</p>
        <h1 class="Nexora_pageTitle">${escapeHtml(name)}</h1>
        <p class="Nexora_pageLead">Bu kateqoriyaya aid açıq kurslar və aktiv alt kateqoriyalar.</p>
      </div>`;
      document.title = `${name} | Nexora Academy`;
      const children = categoryState.visible.filter(
        (item) => String(item.parentId) === categoryId,
      );
      childrenContainer.innerHTML = children
        .map((item) => renderCategoryCard(item, categoryState))
        .join("");
      childrenStatus.textContent = children.length
        ? `${children.length} alt kateqoriya`
        : "Aktiv alt kateqoriya yoxdur";

      const params = new URLSearchParams({
        page: "0",
        size: "24",
        sort: "title,asc",
        categoryId,
        published: "true",
        active: "true",
      });
      const page = await apiFetch(`/api/v1/public/catalog/courses?${params}`, { signal });
      if (signal.aborted) return;
      const categoryNames = new Map(
        categoryState.visible.map((item) => [
          String(item.id),
          item.name || item.slug || String(item.id),
        ]),
      );
      const courses = (Array.isArray(page?.content) ? page.content : []).filter(
        (course) =>
          String(course.categoryId) === categoryId &&
          isPublicCourse(course, categoryState.visibleIds),
      );
      coursesContainer.innerHTML = courses.length
        ? courses
            .map((course) => renderCourseCard(course, categoryNames))
            .join("")
        : '<div class="Nexora_emptyState"><h3>Açıq kurs tapılmadı</h3><p>Bu kateqoriyada hazırda açıq kurs yoxdur.</p></div>';
      coursesStatus.textContent = `${courses.length} açıq kurs`;
    } catch (error) {
      if (error?.name === "AbortError") return;
      details.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kateqoriya hazırda əlçatan deyil</h1><p>Kateqoriya kataloquna qayıdaraq yenidən seçim edin.</p></div>';
      childrenContainer.innerHTML = "";
      coursesContainer.innerHTML = "";
      childrenStatus.textContent = "";
      coursesStatus.textContent = "";
    }
  }

  function safeCourseDetailUrl(value, fallback = "") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    if (!PROTOCOL_REGEX.test(raw) && !raw.startsWith("//")) return raw;
    try {
      const parsed = new URL(raw, location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? raw : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function courseTitleToFile(title) {
    return String(title || "").trim().replaceAll(/\s+/g, "_");
  }

  function courseDetailTextList(value) {
    return (Array.isArray(value) ? value : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  function renderCourseModules(modules) {
    const items = (Array.isArray(modules) ? modules : [])
      .map((module, index) => {
        const objectModule =
          module && typeof module === "object" && !Array.isArray(module)
            ? module
            : null;
        const title = String(
          objectModule ? objectModule.title || "" : module || "",
        ).trim();
        const topics = courseDetailTextList(objectModule?.topics);
        if (!title && !topics.length) return "";
        return `<article class="Nexora_courseDetailV2__module">
          <span class="Nexora_courseDetailV2__moduleIndex">${String(index + 1).padStart(2, "0")}</span>
          <div>
            ${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
            ${
              topics.length
                ? `<ul>${topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ul>`
                : ""
            }
          </div>
        </article>`;
      })
      .filter(Boolean);
    return items.length
      ? `<section class="Nexora_courseDetailV2__contentSection">
          <div class="Nexora_courseDetailV2__sectionHeading">
            <p class="Nexora_eyebrow">Tədris planı</p>
            <h2>Kurs proqramı</h2>
          </div>
          <div class="Nexora_courseDetailV2__modules">${items.join("")}</div>
        </section>`
      : "";
  }

  function renderCourseRequirements(requirements) {
    const items = courseDetailTextList(requirements);
    return items.length
      ? `<section class="Nexora_courseDetailV2__contentSection">
          <div class="Nexora_courseDetailV2__sectionHeading">
            <p class="Nexora_eyebrow">Başlamazdan əvvəl</p>
            <h2>Tələblər</h2>
          </div>
          <ul class="Nexora_courseDetailV2__checkList">
            ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>`
      : "";
  }

  function courseMockFallback(course) {
    const context =
      `${course.title || ""} ${course.categoryName || ""}`.toLocaleLowerCase(
        "az",
      );
    if (COURSE_CLOUD_REGEX.test(context))
      return MOCK_IMAGE_FALLBACKS["course-cloud-devops"];
    if (COURSE_CYBER_REGEX.test(context))
      return MOCK_IMAGE_FALLBACKS["course-cybersecurity"];
    return MOCK_IMAGE_FALLBACKS["course-networking"];
  }

  function renderCourseInstructor(instructor) {
    if (!instructor || typeof instructor !== "object") return "";
    const name = String(instructor.name || "").trim();
    if (!name) return "";
    const title = String(instructor.title || "").trim();
    const fallbackIndex = (name.codePointAt(0) || 0) % 3;
    const fallback = MOCK_IMAGE_FALLBACKS[`instructor-${fallbackIndex + 1}`];
    const realImageUrl = safeCourseDetailUrl(instructor.imageUrl);
    const imageUrl = realImageUrl || fallback.src;
    const imageAlt = realImageUrl ? instructor.imageAlt || name : fallback.alt;
    return `<section class="Nexora_courseDetailV2__contentSection">
      <div class="Nexora_courseDetailV2__sectionHeading">
        <p class="Nexora_eyebrow">Təlimçi</p>
        <h2>Müəllim haqqında</h2>
      </div>
      <div class="Nexora_courseDetailV2__instructor">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy" />
        <div>
          <h3>${escapeHtml(name)}</h3>
          ${title ? `<p>${escapeHtml(title)}</p>` : ""}
        </div>
      </div>
    </section>`;
  }

  function renderCourseDetails(course, options = {}) {
    course = courseViewModel(course);
    const title = course.title || "Kurs";
    const description =
      course.fullDescription ||
      course.description ||
      course.shortDescription ||
      "Bu kurs haqqında ətraflı məlumat hazırlanır.";
    const shortDescription =
      course.shortDescription ||
      course.description ||
      course.fullDescription ||
      "";
    const deliveryFormat = enumLabel(course.deliveryFormat);
    const duration = course.durationWeeks
      ? `${course.durationWeeks} həftə`
      : "";
    const difficulty = enumLabel(course.difficulty);
    const courseFallback = courseMockFallback(course);
    const realImageUrl = safeCourseDetailUrl(course.imageUrl);
    const nameBasedPath = `assets/courses/${courseTitleToFile(title)}.svg`;
    const imageUrl = realImageUrl || nameBasedPath;
    const imageAlt = realImageUrl
      ? course.imageAlt || `${title} kursunun əsas vizualı`
      : `${title} kursunun əsas vizualı`;
    const categoryName = options.categoryName || "Nexora Academy";
    const metaItems = [difficulty, deliveryFormat, duration].filter(Boolean);
    const courseId = String(course.id || "").trim();
    const explicitRegistrationUrl = safeCourseDetailUrl(course.registrationUrl);
    const accountLink = explicitRegistrationUrl || "contact.html";
    const accountLabel = explicitRegistrationUrl
      ? "Qeydiyyatdan keç"
      : "Qeydiyyat barədə məlumat al";
    const requirements = renderCourseRequirements(course.requirements);
    const modules = renderCourseModules(course.modules);
    const instructor = renderCourseInstructor(course.instructor);
    const certificateText = String(course.certificateText || "").trim();
    const relatedIds = Array.isArray(course.relatedCourseIds)
      ? course.relatedCourseIds.filter(
          (id) => id && String(id) !== String(course.id || ""),
        )
      : [];
    const detailRows = [
      ["Tədris formatı", deliveryFormat || "Məlumat dəqiqləşdirilir"],
      ["Müddət", duration || "Məlumat dəqiqləşdirilir"],
      ...(difficulty ? [["Səviyyə", difficulty]] : []),
      ...(course.locationText ? [["Məkan", course.locationText]] : []),
      ...(course.pricePeriod ? [["Ödəniş dövrü", course.pricePeriod]] : []),
    ];

    return `<div class="Nexora_courseDetailV2">
      <section class="Nexora_courseDetailV2__hero">
        <div class="Nexora_courseDetailV2__heroCopy">
          <p class="Nexora_eyebrow">${escapeHtml(categoryName)}</p>
          ${
            metaItems.length
              ? `<div class="Nexora_courseMeta">${metaItems.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
              : ""
          }
          <h1 class="Nexora_pageTitle">${escapeHtml(title)}</h1>
          ${shortDescription ? `<p class="Nexora_pageLead">${escapeHtml(shortDescription)}</p>` : ""}
        </div>
        <figure class="Nexora_courseDetailV2__visual">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" onerror="this.onerror=null;this.src='${escapeHtml(courseFallback.src)}';this.alt='${escapeHtml(courseFallback.alt)}'" />
        </figure>
      </section>

      <div class="Nexora_courseDetailV2__contentLayout">
        <div class="Nexora_courseDetailV2__contentMain">
          <section class="Nexora_courseDetailV2__contentSection">
            <div class="Nexora_courseDetailV2__sectionHeading">
              <p class="Nexora_eyebrow">Ətraflı məlumat</p>
              <h2>Kurs haqqında</h2>
            </div>
            <div class="Nexora_courseDetailV2__richText"><p>${escapeHtml(description)}</p></div>
          </section>

          ${
            course.targetAudience
              ? `<section class="Nexora_courseDetailV2__contentSection">
                  <div class="Nexora_courseDetailV2__sectionHeading">
                    <p class="Nexora_eyebrow">Uyğunluq</p>
                    <h2>Kimlər üçün nəzərdə tutulub?</h2>
                  </div>
                  <p class="Nexora_courseDetailV2__bodyText">${escapeHtml(course.targetAudience)}</p>
                </section>`
              : ""
          }
          ${modules}
          ${requirements}
          ${
            certificateText
              ? `<section class="Nexora_courseDetailV2__contentSection">
                  <div class="Nexora_courseDetailV2__sectionHeading">
                    <p class="Nexora_eyebrow">Nəticə</p>
                    <h2>Sertifikat</h2>
                  </div>
                  <p class="Nexora_courseDetailV2__bodyText">${escapeHtml(certificateText)}</p>
                </section>`
              : ""
          }
          ${instructor}
        </div>

        <aside class="Nexora_panel Nexora_courseAside Nexora_courseDetailV2__aside">
          <div>
            <p class="Nexora_eyebrow">Kursun qiyməti</p>
            <strong class="Nexora_detailPrice">${escapeHtml(formatPrice(course.basePrice, course.currency))}</strong>
          </div>
          <dl class="Nexora_detailList">
            ${detailRows
              .map(
                ([label, value]) =>
                  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
              )
              .join("")}
          </dl>
          <a class="ai-btn ai-btn--gradient Nexora_courseDetailV2__cta" href="${escapeHtml(accountLink)}">${escapeHtml(accountLabel)}</a>
          <p class="Nexora_muted">Qrup tarixləri, mövcud yerlər və yekun qeydiyyat məlumatları təsdiqləndikdə təqdim ediləcək.</p>
        </aside>
      </div>

      ${
        relatedIds.length
          ? `<section class="Nexora_courseDetailV2__related">
              <div class="Nexora_courseDetailV2__sectionHeading">
                <p class="Nexora_eyebrow">Davam et</p>
                <h2>Əlaqəli kurslar</h2>
              </div>
              <p class="Nexora_status" id="relatedCoursesStatus">Əlaqəli kurslar yüklənir…</p>
              <div class="Nexora_courseGrid" id="relatedCourses"></div>
            </section>`
          : ""
      }
    </div>`;
  }

  function initCourseDetailsPage(signal) {
    const container = $("#courseDetails");
    if (!container) return;

    const params = new URLSearchParams(location.search);
    const courseSlug = params.get("course")?.trim() || "";

    let relatedContainer = null;
    let relatedStatus = null;

    const courseId = params.get("id")?.trim() || "";
    if (!courseId && !courseSlug) {
      container.innerHTML =
        '<div class="Nexora_emptyState"><h1>Kurs seçilməyib</h1><p>Kataloqdan kurs seçərək yenidən yoxlayın.</p></div>';
      return;
    }

    const loadCourse = async () => {
      try {
        const courseRequest = courseId
          ? apiFetch(`/api/v1/public/catalog/courses/${encodeURIComponent(courseId)}`, {
              signal,
            })
          : apiFetch(
              `/api/v1/public/catalog/courses?${new URLSearchParams({
                q: courseSlug,
                page: "0",
                size: "20",
                published: "true",
                active: "true",
              })}`,
              { signal },
            ).then((page) => {
              const course = (
                Array.isArray(page?.content) ? page.content : []
              ).find((item) => String(item?.slug || "") === courseSlug);
              if (!course) throw new ApiError(404, "Kurs tapılmadı.");
              return course;
            });
        const [course, categories] = await Promise.all([
          courseRequest,
          cachedApiFetch("/api/v1/public/catalog/categories", { signal }),
        ]);
        if (signal.aborted) return;
        const categoryState = publicCategoryState(categories);
        if (!isPublicCourse(course, categoryState.visibleIds))
          throw new ApiError(404, "Kurs hazırda əlçatan deyil.");
        const category = categoryState.byId.get(String(course.categoryId));
        container.innerHTML = renderCourseDetails(course || {}, {
          categoryName: category?.name || category?.slug || "Nexora Academy",
        });
        relatedContainer = $("#relatedCourses", container);
        relatedStatus = $("#relatedCoursesStatus", container);
        if (course?.title) document.title = `${course.title} | Nexora Academy`;
        const relatedIds = [
          ...new Set(
            (Array.isArray(course.relatedCourseIds)
              ? course.relatedCourseIds
              : []
            )
              .map(String)
              .filter((id) => id && id !== String(course.id)),
          ),
        ].slice(0, 3);
        if (!relatedContainer || !relatedStatus) return;
        if (!relatedIds.length) {
          relatedStatus.textContent = "Əlaqəli açıq kurs tapılmadı.";
          relatedContainer.innerHTML = "";
          return;
        }
        relatedStatus.textContent = "Əlaqəli kurslar yüklənir…";
        const relatedResults = await Promise.allSettled(
          relatedIds.map((id) =>
            apiFetch(`/api/v1/public/catalog/courses/${encodeURIComponent(id)}`, { signal }),
          ),
        );
        if (signal.aborted) return;
        const relatedCourses = relatedResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((item) => isPublicCourse(item, categoryState.visibleIds));
        const categoryNames = new Map(
          categoryState.visible.map((category) => [
            String(category.id),
            category.name || category.slug || String(category.id),
          ]),
        );
        relatedContainer.innerHTML = relatedCourses
          .map((item) => renderCourseCard(item, categoryNames))
          .join("");
        relatedStatus.textContent = relatedCourses.length
          ? `${relatedCourses.length} əlaqəli açıq kurs`
          : "Əlaqəli açıq kurs tapılmadı.";
      } catch (error) {
        if (error?.name === "AbortError") return;
        container.innerHTML =
          '<div class="Nexora_emptyState"><h1>Kurs hazırda əlçatan deyil</h1><p>Kataloqa qayıdaraq digər açıq kurslara baxın.</p></div>';
        if (relatedContainer) relatedContainer.innerHTML = "";
        if (relatedStatus) relatedStatus.textContent = "";
      }
    };

    void loadCourse();
  }

  function initApiPage(signal) {
    switch (document.body.dataset.page) {
      case "home":
        void initHomeFeaturedCourses(signal);
        void initNewsSection(signal);
        break;
      case "courses":
        initProjectCoursesPage(signal);
        break;
      case "categories":
        void initCategoriesPage(signal);
        break;
      case "category":
        void initCategoryPage(signal);
        break;
      case "course-details":
        initCourseDetailsPage(signal);
        break;
      case "faq":
        void initFaqPage(signal);
        break;
      case "haqqimizda":
        void initAcademyPage(signal);
        break;
      case "elaqe":
        void initContactPage(signal);
        break;
      case "career":
        void initCareerContent(signal);
        void initVacanciesPage(signal);
        break;
      case "vacancy-details":
        void initVacancyDetailsPage(signal);
        break;
      case "news":
        void initNewsPage(signal);
        break;
      case "news-details":
        void initNewsDetailsPage(signal);
        break;
      default:
        break;
    }
  }

  function initStandaloneTarget() {
    const target = new URLSearchParams(location.search).get("target");
    if (!target) return;
    const node = document.getElementById(target);
    if (!node) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        node.classList.remove("naic-target-flash");
        requestAnimationFrame(() => node.classList.add("naic-target-flash"));
      }),
    );
  }

  const STAT_COUNT_UP_DURATION_MS = 1800;

  function initStatCounters(signal) {
    if (signal?.aborted) return;
    const root = $(".stat-section");
    if (!root) return;
    const counters = $$(".stat-section__count", root);
    if (!counters.length) return;

    const targets = counters.map((counter) => {
      const match = String(counter.textContent || "").match(
        /^\s*(\d+)\s*(\+)?\s*$/,
      );
      return {
        counter,
        value: match ? parseInt(match[1], 10) : 0,
        suffix: match && match[2] ? "+" : "",
      };
    });

    const run = () => {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        targets.forEach(({ counter, value, suffix }) => {
          counter.textContent = `${value}${suffix}`;
        });
        return;
      }
      const start = performance.now();
      targets.forEach(({ counter, value, suffix }) => {
        counter.textContent = `0${suffix}`;
      });
      const tick = (now) => {
        const progress = Math.min((now - start) / STAT_COUNT_UP_DURATION_MS, 1);
        const eased = progress >= 1 ? 1 : 1 - Math.pow(1 - progress, 3);
        targets.forEach(({ counter, value, suffix }) => {
          counter.textContent = `${Math.round(eased * value)}${suffix}`;
        });
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          run();
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
  }

  function initFaqAccordion(signal) {
    const root = $(".faq-accordion");
    if (!root) return;
    const items = $$(".faq-item", root);
    if (!items.length) return;
    items.forEach((item) => {
      const question = $(".faq-question", item);
      const answer = $(".faq-answer", item);
      if (!question || !answer) return;
      question.addEventListener(
        "click",
        () => {
          const isOpen = item.classList.contains("is-open");
          items.forEach((other) => {
            const otherQuestion = $(".faq-question", other);
            const otherAnswer = $(".faq-answer", other);
            other.classList.remove("is-open");
            if (otherQuestion)
              otherQuestion.setAttribute("aria-expanded", "false");
            if (otherAnswer) otherAnswer.style.maxHeight = "0px";
          });
          if (!isOpen) {
            item.classList.add("is-open");
            question.setAttribute("aria-expanded", "true");
            answer.style.maxHeight = `${answer.scrollHeight}px`;
          }
        },
        { signal },
      );
    });
  }

  const ROADMAP_DURATION = 7000;
  let roadmapAnimationFrame = 0;
  let roadmapAnimationStartedAt = 0;

  function roadmapSetPath(path, d) {
    if (path) path.setAttribute("d", d);
  }

  function updateRoadmapDualTrackGeometry() {
    document
      .querySelectorAll(".roadmap__timeline-wrapper")
      .forEach((wrapper) => {
        const svg = wrapper.querySelector(".dual-track__line");
        if (!svg) return;

        const computed = window.getComputedStyle(wrapper);
        const gap =
          parseFloat(computed.getPropertyValue("--roadmap-track-gap")) || 280;
        const verticalInset =
          parseFloat(
            computed.getPropertyValue("--roadmap-track-inset"),
          ) || 60;
        const svgHeight = gap + verticalInset * 2;
        const centerY = svgHeight / 2;
        const upperY = centerY - gap / 2;
        const lowerY = centerY + gap / 2;

        svg.style.height = svgHeight + "px";
        svg.setAttribute("viewBox", "0 0 1000 " + svgHeight);

        const wrapperRect = wrapper.getBoundingClientRect();
        const currentDot = wrapper.querySelector(
          ".roadmap__item--current .roadmap__dot-wrapper--current",
        );
        const currentRect = currentDot
          ? currentDot.getBoundingClientRect()
          : null;

        let mergeX = 870;
        if (currentRect && wrapperRect.width) {
          mergeX =
            ((currentRect.left +
              currentRect.width / 2 -
              wrapperRect.left) /
              wrapperRect.width) *
            1000;
        }
        mergeX = Math.max(780, Math.min(920, mergeX));

        const splitX = 192;
        const parallelStartX = 220;
        const mergeStartX = mergeX - 55;
        const splitControlX = splitX + 28;
        const mergeControlX = mergeX - 28;

        const entryD = "M 0 " + centerY + " L " + splitX + " " + centerY;
        const upperD =
          "M " + splitX + " " + centerY +
          " C " + splitControlX + " " + centerY + " " + splitControlX + " " + upperY + " " + parallelStartX + " " + upperY +
          " L " + mergeStartX + " " + upperY +
          " C " + mergeControlX + " " + upperY + " " + mergeControlX + " " + centerY + " " + mergeX + " " + centerY;
        const lowerD =
          "M " + splitX + " " + centerY +
          " C " + splitControlX + " " + centerY + " " + splitControlX + " " + lowerY + " " + parallelStartX + " " + lowerY +
          " L " + mergeStartX + " " + lowerY +
          " C " + mergeControlX + " " + lowerY + " " + mergeControlX + " " + centerY + " " + mergeX + " " + centerY;
        const exitD = "M " + mergeX + " " + centerY + " L 1000 " + centerY;
        const upperMotionD =
          "M 25 " + centerY +
          " L " + splitX + " " + centerY +
          " C " + splitControlX + " " + centerY + " " + splitControlX + " " + upperY + " " + parallelStartX + " " + upperY +
          " L " + mergeStartX + " " + upperY +
          " C " + mergeControlX + " " + upperY + " " + mergeControlX + " " + centerY + " " + mergeX + " " + centerY +
          " L 975 " + centerY;
        const lowerMotionD =
          "M 25 " + centerY +
          " L " + splitX + " " + centerY +
          " C " + splitControlX + " " + centerY + " " + splitControlX + " " + lowerY + " " + parallelStartX + " " + lowerY +
          " L " + mergeStartX + " " + lowerY +
          " C " + mergeControlX + " " + lowerY + " " + mergeControlX + " " + centerY + " " + mergeX + " " + centerY +
          " L 975 " + centerY;

        roadmapSetPath(svg.querySelector(".dual-track__stroke--entry"), entryD);
        roadmapSetPath(svg.querySelector(".dual-track__stroke--upper"), upperD);
        roadmapSetPath(svg.querySelector(".dual-track__stroke--lower"), lowerD);
        roadmapSetPath(svg.querySelector(".dual-track__stroke--exit"), exitD);
        roadmapSetPath(svg.querySelector(".dual-track__motion--upper"), upperMotionD);
        roadmapSetPath(svg.querySelector(".dual-track__motion--lower"), lowerMotionD);
      });
  }

  function roadmapEaseInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function roadmapPlaceMovingLight(wrapper, path, light, progress) {
    if (!path || !light || !path.getTotalLength) return;
    const length = path.getTotalLength();
    if (!length) return;
    const point = path.getPointAtLength(length * progress);
    const svg = wrapper.querySelector(".dual-track__line");
    if (!svg) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const x =
      svgRect.left -
      wrapperRect.left +
      ((point.x - viewBox.x) / viewBox.width) * svgRect.width;
    const y =
      svgRect.top -
      wrapperRect.top +
      ((point.y - viewBox.y) / viewBox.height) * svgRect.height;
    light.style.left = x + "px";
    light.style.top = y + "px";
  }

  function animateRoadmapLights(now) {
    if (!roadmapAnimationStartedAt) roadmapAnimationStartedAt = now;
    const raw =
      ((now - roadmapAnimationStartedAt) % ROADMAP_DURATION) / ROADMAP_DURATION;
    const progress = roadmapEaseInOut(raw);
    let opacity =
      raw < 0.08 ? raw / 0.08 : raw > 0.94 ? (1 - raw) / 0.06 : 1;
    opacity = Math.max(0, Math.min(1, opacity));

    document
      .querySelectorAll(".roadmap__timeline-wrapper")
      .forEach((wrapper) => {
        const upperPath = wrapper.querySelector(".dual-track__motion--upper");
        const lowerPath = wrapper.querySelector(".dual-track__motion--lower");
        const upperLight = wrapper.querySelector(".dual-track__moving-light--upper");
        const lowerLight = wrapper.querySelector(".dual-track__moving-light--lower");
        roadmapPlaceMovingLight(wrapper, upperPath, upperLight, progress);
        roadmapPlaceMovingLight(wrapper, lowerPath, lowerLight, progress);
        if (upperLight) upperLight.style.opacity = opacity;
        if (lowerLight) lowerLight.style.opacity = opacity;
      });

    roadmapAnimationFrame = window.requestAnimationFrame(animateRoadmapLights);
  }

  function initializeRoadmapDualTracks() {
    updateRoadmapDualTrackGeometry();
    document
      .querySelectorAll(".roadmap__timeline-wrapper img")
      .forEach((img) => {
        if (!img.complete)
          img.addEventListener("load", updateRoadmapDualTrackGeometry);
      });
    if ("ResizeObserver" in window) {
      document
        .querySelectorAll(".roadmap__timeline-wrapper")
        .forEach((w) => {
          new ResizeObserver(updateRoadmapDualTrackGeometry).observe(w);
        });
    }
    window.cancelAnimationFrame(roadmapAnimationFrame);
    roadmapAnimationStartedAt = 0;
    roadmapAnimationFrame = window.requestAnimationFrame(animateRoadmapLights);
  }

  function initRoadmap(signal) {
    if (!document.querySelector(".roadmap__timeline-wrapper")) return;
    window.addEventListener("load", initializeRoadmapDualTracks);
    window.addEventListener("resize", updateRoadmapDualTrackGeometry);
    if (
      document.readyState === "interactive" ||
      document.readyState === "complete"
    ) {
      initializeRoadmapDualTracks();
    }
    signal?.addEventListener(
      "abort",
      () => {
        window.cancelAnimationFrame(roadmapAnimationFrame);
        window.removeEventListener("load", initializeRoadmapDualTracks);
        window.removeEventListener("resize", updateRoadmapDualTrackGeometry);
      },
      { once: true },
    );
  }

  function initCareerTilt(signal) {
    const cards = $$('[data-parallax-tilt="true"]');
    if (!cards.length) return;
    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cards.forEach((card) => {
      if (reduceMotion) return;
      const image = $(".career-parallax-image", card);
      const maxRotate = 17;
      const cardScale = 1.025;
      const imageShift = 10;
      let raf = 0;
      let lastEvent = null;

      function renderTilt() {
        raf = 0;
        if (!lastEvent) return;
        const rect = card.getBoundingClientRect();
        const x = lastEvent.clientX - rect.left;
        const y = lastEvent.clientY - rect.top;
        const nx = Math.max(
          -1,
          Math.min(1, (x - rect.width / 2) / (rect.width / 2)),
        );
        const ny = Math.max(
          -1,
          Math.min(1, (y - rect.height / 2) / (rect.height / 2)),
        );
        const rotateY = nx * maxRotate;
        const rotateX = -ny * maxRotate;
        card.style.transform =
          "perspective(850px) rotateX(" +
          rotateX.toFixed(2) +
          "deg) rotateY(" +
          rotateY.toFixed(2) +
          "deg) scale3d(" +
          cardScale +
          ", " +
          cardScale +
          ", " +
          cardScale +
          ")";
        if (image) {
          image.style.transform =
            "translate3d(" +
            (-nx * imageShift).toFixed(2) +
            "px," +
            (-ny * imageShift).toFixed(2) +
            "px,52px) scale(1.075)";
        }
      }

      function resetCard() {
        lastEvent = null;
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        card.classList.remove("is-tilting");
        card.style.transform =
          "perspective(850px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
        if (image)
          image.style.transform = "translate3d(0,0,42px) scale(1.035)";
      }

      function queueTilt(event) {
        lastEvent = event;
        if (!raf) raf = requestAnimationFrame(renderTilt);
      }

      card.addEventListener("pointerenter", (event) => {
        card.classList.add("is-tilting");
        queueTilt(event);
      });
      card.addEventListener("pointermove", queueTilt);
      card.addEventListener("pointerleave", resetCard);
      card.addEventListener("pointercancel", resetCard);
      resetCard();
    });
  }

  function initPage(signal) {
    applyDataImageFallbacks();
    initStandaloneTarget();
    initHeader(signal);
    initHeroMedia(signal);
    initApplicationForm(signal);
    initSimpleForms(signal);
    initVacancies(signal);
    initSliders(signal);
    initPhoneInputs(signal);
    initFaqAccordion(signal);
    initRoadmap(signal);
    initCareerTilt(signal);
    initApiPage(signal);
    void initSiteSettings(signal);
    if (document.body.dataset.page === "home") {
      void initHomeContent(signal).finally(() => {
        if (signal.aborted) return;
        initHeroTypewriter(signal);
        initStatCounters(signal);
      });
    } else {
      initHeroTypewriter(signal);
      initStatCounters(signal);
    }
  }

  const boot = () => {
    pageController?.abort();
    pageController = new AbortController();
    initPage(pageController.signal);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
