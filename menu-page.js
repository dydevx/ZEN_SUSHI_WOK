const categories = window.ZEN_MENU_CATEGORIES || [];
const menuData = window.ZEN_MENU_DATA || {};
const categoryFolders = window.ZEN_CATEGORY_FOLDERS || {};
const menuGroups = normalizeMenuGroups(window.ZEN_MENU_GROUPS, categories);

const nav = document.getElementById("mainNav");
const display = document.getElementById("foodDisplay");
const title = document.getElementById("currentCategoryName");
const homeSection = document.getElementById("homeSection");
const cartCountEl = document.getElementById("cartCount");
const clearCartButton = document.getElementById("clearCartButton");
const modal = document.getElementById("dishModal");
const modalImage = document.getElementById("modalImage");
const modalDishName = document.getElementById("modalDishName");
const modalPieces = document.getElementById("modalPieces");
const modalPrice = document.getElementById("modalPrice");
const modalDescription = document.getElementById("modalDescription");
const modalComposition = document.getElementById("modalComposition");
const modalAllergenes = document.getElementById("modalAllergenes");
const modalOptionsBlock = document.getElementById("modalOptionsBlock");
const modalAddButton = document.getElementById("modalAddButton");
const cartToast = document.getElementById("cartToast");
const groupSubnav = document.createElement("div");
groupSubnav.className = "group-subnav";
groupSubnav.hidden = true;
nav.insertAdjacentElement("afterend", groupSubnav);
const selectedSubnav = document.createElement("div");
selectedSubnav.className = "selected-subnav";
selectedSubnav.hidden = true;
groupSubnav.insertAdjacentElement("afterend", selectedSubnav);
const mobileMenuQuery = window.matchMedia("(max-width: 760px)");

let activeDish = null;
let toastTimer = null;
let cartCount = getStoredCartCount();
const selectedGroupItems = new Map();

updateCartCount();

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[char]));
}

function normalizeMenuGroups(groups, fallbackCategories) {
    if (Array.isArray(groups) && groups.length) {
        return groups.map((group) => ({
            label: group.label,
            items: (group.items || [])
                .map((item) => ({
                    label: item.label || item.category,
                    category: item.category,
                    filter: item.filter || ""
                }))
                .filter((item) => item.category && menuData[item.category])
        })).filter((group) => group.label && group.items.length);
    }

    return fallbackCategories.map((category) => ({
        label: category,
        items: [{ label: category, category, filter: "" }]
    }));
}

function getStoredCartCount() {
    try {
        return Number(localStorage.getItem("zenCartCount")) || 0;
    } catch (error) {
        return 0;
    }
}

function storeCartCount() {
    try {
        localStorage.setItem("zenCartCount", String(cartCount));
    } catch (error) {
        // Local files can run in browsers with storage disabled.
    }
}

function updateCartCount() {
    cartCountEl.textContent = String(cartCount);
    clearCartButton.hidden = cartCount === 0;
}

function showToast(message) {
    cartToast.textContent = message;
    cartToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => cartToast.classList.remove("show"), 1800);
}

function addToCart(item) {
    cartCount += 1;
    storeCartCount();
    updateCartCount();
    showToast(`${item.name} ajouté au panier`);
}

function clearCart() {
    if (cartCount === 0) return;
    if (!window.confirm("Vider le panier ?")) return;

    cartCount = 0;
    try {
        localStorage.removeItem("zenCartCount");
        localStorage.removeItem("zenCartItems");
    } catch (error) {
        // Local files can run in browsers with storage disabled.
    }
    updateCartCount();
    showToast("Panier vidé");
}

function formatPrice(price) {
    if (!price) return "";
    const value = String(price).trim();
    if (/€|Voir carte|Sur demande|À confirmer/i.test(value)) return value;
    return `${value.replace(/\./g, ",")} €`;
}

function getMenuImageSources(folderName, fileName) {
    if (!folderName || !fileName) return null;
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    return {
        optimized: encodeURI(`menu-optimized/${folderName}/${baseName}.jpg`),
        original: encodeURI(`menu/${folderName}/${fileName}`)
    };
}

function markImageLoaded(img, imgBox) {
    img.classList.add("is-loaded");
    imgBox.classList.remove("loading");
}

function setupImageFallback(img, imgBox) {
    img.onload = () => markImageLoaded(img, imgBox);
    img.onerror = () => {
        const fallbackSrc = img.dataset.fallbackSrc;
        if (fallbackSrc) {
            img.dataset.fallbackSrc = "";
            img.src = fallbackSrc;
            return;
        }
        markImageLoaded(img, imgBox);
    };

    if (img.complete) {
        if (img.naturalWidth > 0) markImageLoaded(img, imgBox);
        else img.onerror();
    }
}

function makePlaceholder(label) {
    return `<div class="placeholder-art">${escapeHtml(label || "Zen Sushi Wok")}</div>`;
}

function inferAllergenes(item) {
    const text = `${item.name} ${item.composition} ${item.description}`.toLowerCase();
    const allergenes = [];
    const add = (label, pattern) => {
        if (pattern.test(text) && !allergenes.includes(label)) allergenes.push(label);
    };

    add("Poisson", /saumon|thon|poisson|sashimi|sushi|tataki/);
    add("Crustacés", /crevette|crevettes|tempura|seiche|seiches/);
    add("Gluten", /panko|corn flakes|pané|panée|tempura|nouilles|udon|gyoza|nems|cheesecake|beignet/);
    add("Lait", /cheese|fromage|lait|cheesecake|mochi cream/);
    add("Sésame", /sésame|sesame/);
    add("Soja", /soja|tofu|edamame|miso|yakitori/);
    add("Œufs", /mayonnaise|mayo/);
    add("Arachides", /cacahuète|cacahuete/);
    add("Sulfites", /vin rouge|vin blanc|vin rosé|bière/);

    return allergenes.length ? allergenes : ["À confirmer"];
}

function isDrinkCategory(category) {
    return category === "BOISSON" || category === "VINS";
}

function getGroupItemKey(groupItem) {
    return `${groupItem.category}::${groupItem.filter || ""}`;
}

function slugify(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getCategoryItems(category, filter = "") {
    const items = menuData[category] || [];
    if (filter === "tartare") return items.filter((item) => /tartare/i.test(item.name));
    if (filter === "chirashi") return items.filter((item) => !/tartare/i.test(item.name));
    if (filter === "bieres") return items.filter((item) => /bière|biere/i.test(item.name));
    if (filter === "softs") return items.filter((item) => !/bière|biere/i.test(item.name));
    return items;
}

function renderFoods(category, titleLabel = category, filter = "") {
    display.innerHTML = "";
    title.textContent = titleLabel;
    const folderName = categoryFolders[category];
    const items = getCategoryItems(category, filter);
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const card = document.createElement("article");
        card.className = category === "VINS" ? "food-card wine-card" : "food-card";
        const sources = getMenuImageSources(folderName, item.fileName);
        const isPriorityImage = index < 4;
        const pieces = item.pieces || "";
        const imageMarkup = sources
            ? `<img loading="${isPriorityImage ? "eager" : "lazy"}" fetchpriority="${isPriorityImage ? "high" : "low"}" decoding="async" width="700" height="700" src="${sources.optimized}" data-fallback-src="${sources.original}" alt="${escapeHtml(item.name)}">`
            : makePlaceholder(item.name);

        card.innerHTML = `
            <div class="card-stack">
                <button class="image-trigger" type="button" aria-label="Voir ${escapeHtml(item.name)}">
                    <div class="img-box${sources ? " loading" : ""}">
                        ${imageMarkup}
                        ${pieces ? `<div class="badge">${escapeHtml(pieces)}</div>` : ""}
                    </div>
                </button>
                <div class="food-info">
                    <div>
                        <h3 class="food-name">${escapeHtml(item.name)}</h3>
                        <p class="food-composition"><span>Composition:</span> ${escapeHtml(item.composition || "À compléter")}</p>
                        <p class="food-description">${escapeHtml(item.description || item.composition || "")}</p>
                    </div>
                    <div class="food-bottom">
                        ${pieces ? `<span class="food-pieces">${escapeHtml(pieces)}</span>` : "<span></span>"}
                        <strong class="food-price">${escapeHtml(formatPrice(item.price))}</strong>
                    </div>
                    <button class="add-btn" type="button">+ Ajouter</button>
                </div>
            </div>
        `;

        card.querySelector(".image-trigger").addEventListener("click", () => openDishModal(item, category));
        card.querySelector(".add-btn").addEventListener("click", () => addToCart(item));

        if (sources) {
            setupImageFallback(card.querySelector("img"), card.querySelector(".img-box"));
        }

        fragment.appendChild(card);
    });

    display.appendChild(fragment);
}

function openDishModal(item, category) {
    const folderName = categoryFolders[category];
    const sources = getMenuImageSources(folderName, item.fileName);
    activeDish = item;

    modalDishName.textContent = item.name;
    modalPieces.textContent = item.pieces || "";
    modalPieces.style.display = item.pieces ? "inline-flex" : "none";
    modalPrice.textContent = formatPrice(item.price);
    modalDescription.textContent = item.description || item.composition || "Détails à confirmer auprès du restaurant.";
    modalComposition.textContent = item.composition || "Composition à confirmer auprès du restaurant.";
    modalAllergenes.innerHTML = inferAllergenes(item).map((label) => `<li>${escapeHtml(label)}</li>`).join("");
    modalOptionsBlock.style.display = isDrinkCategory(category) ? "none" : "block";
    modal.classList.toggle("wine-modal", category === "VINS");

    if (sources) {
        modalImage.innerHTML = `<img src="${sources.optimized}" data-fallback-src="${sources.original}" alt="${escapeHtml(item.name)}">`;
        setupImageFallback(modalImage.querySelector("img"), modalImage);
    } else {
        modalImage.innerHTML = makePlaceholder(item.name);
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeDishModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    activeDish = null;
}

function setActiveGroup(groupButton) {
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item === groupButton);
        if (item !== groupButton) item.setAttribute("aria-expanded", "false");
    });

    if (groupButton) {
        groupButton.classList.add("active");
        const navWidth = nav.offsetWidth;
        nav.scrollTo({ left: groupButton.offsetLeft - navWidth / 2 + groupButton.offsetWidth / 2, behavior: "smooth" });
    }
}

function setActiveSubItem(activeKey) {
    groupSubnav.querySelectorAll(".subnav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.key === activeKey);
    });
}

function hideGroupSubnav() {
    groupSubnav.hidden = true;
    groupSubnav.innerHTML = "";
}

function makeTitleLabel(group, groupItem) {
    if (!group || !groupItem) return groupItem ? groupItem.category : "";
    return group.items.length > 1 ? `${group.label} - ${groupItem.label}` : group.label;
}

function updateSelectedSubnav(group, groupItem) {
    selectedSubnav.textContent = makeTitleLabel(group, groupItem);
    selectedSubnav.hidden = false;
}

function selectCategory(group, groupItem, groupButton, collapseSubnav = false) {
    setActiveGroup(groupButton);
    selectedGroupItems.set(group.label, groupItem);
    if (group.items.length <= 1) {
        hideGroupSubnav();
    } else if (collapseSubnav) {
        groupButton.setAttribute("aria-expanded", "false");
        hideGroupSubnav();
    } else {
        groupButton.setAttribute("aria-expanded", "true");
        renderGroupSubnav(group, groupButton, getGroupItemKey(groupItem));
    }
    if (group.items.length <= 1 || collapseSubnav) {
        updateSelectedSubnav(group, groupItem);
    } else {
        selectedSubnav.hidden = true;
    }
    homeSection.classList.add("hidden");
    renderFoods(groupItem.category, makeTitleLabel(group, groupItem), groupItem.filter);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

function renderGroupSubnav(group, groupButton, activeKey = getGroupItemKey(group.items[0])) {
    groupSubnav.innerHTML = "";
    const fragment = document.createDocumentFragment();

    group.items.forEach((groupItem) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "subnav-item";
        item.dataset.key = getGroupItemKey(groupItem);
        item.textContent = groupItem.label;
        item.addEventListener("click", () => selectCategory(group, groupItem, groupButton, mobileMenuQuery.matches));
        fragment.appendChild(item);
    });

    groupSubnav.appendChild(fragment);
    groupSubnav.hidden = false;
    setActiveSubItem(activeKey);
}

function renderGroupNav() {
    menuGroups.forEach((group) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `nav-item${group.items.length > 1 ? " has-subnav" : ""}`;
        item.textContent = group.label;
        item.setAttribute("aria-expanded", "false");
        item.addEventListener("click", (event) => {
            event.preventDefault();
            const activeItem = groupSubnav.querySelector(".subnav-item.active");
            const currentKey = activeItem ? activeItem.dataset.key : "";
            const selectedItem = selectedGroupItems.get(group.label)
                || group.items.find((groupItem) => getGroupItemKey(groupItem) === currentKey)
                || group.items[0];
            selectCategory(group, selectedItem, item);
        });
        nav.appendChild(item);
    });
}

renderGroupNav();

function selectInitialGroupFromHash() {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;

    const group = menuGroups.find((menuGroup) => slugify(menuGroup.label) === hash);
    const groupIndex = menuGroups.indexOf(group);
    const groupButton = document.querySelectorAll(".nav-item")[groupIndex];
    if (group && groupButton) selectCategory(group, group.items[0], groupButton);
}

selectInitialGroupFromHash();

function scrollToMenu() {
    const firstGroup = menuGroups[0];
    const firstNavItem = document.querySelector(".nav-item");
    if (!firstGroup || !firstNavItem) return;
    selectCategory(firstGroup, firstGroup.items[0], firstNavItem);
}

function showHome() {
    homeSection.classList.remove("hidden");
    display.innerHTML = "";
    title.textContent = "";
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-expanded", "false");
    });
    hideGroupSubnav();
    selectedSubnav.hidden = true;
    if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", closeDishModal);
});

modalAddButton.addEventListener("click", () => {
    if (activeDish) addToCart(activeDish);
    closeDishModal();
});

clearCartButton.addEventListener("click", clearCart);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) closeDishModal();
});
