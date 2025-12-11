/**************************************************
 * SURDY — WHEEL PICKER (1 ~ 180 MINUTES)
 **************************************************/

let wheelElement = document.getElementById('wheel');
let wheelContainer = document.getElementById('wheel-container');

/**************************************************
 * 1) Create minute items (1~180)
 **************************************************/
let minutesList = [];
for (let i = 1; i <= 180; i++) minutesList.push(i);

/* Add to DOM */
minutesList.forEach((min) => {
    let div = document.createElement('div');
    div.innerText = min + '분';
    wheelElement.appendChild(div);
});

/**************************************************
 * 2) Return the currently centered minute value
 **************************************************/
function getCenteredValue() {
    let containerRect = wheelContainer.getBoundingClientRect();
    let centerY = containerRect.top + containerRect.height / 2;

    let items = [...wheelElement.children];
    let closest = null;
    let closestDist = Infinity;

    items.forEach((item, index) => {
        let rect = item.getBoundingClientRect();
        let itemCenter = rect.top + rect.height / 2;
        let dist = Math.abs(centerY - itemCenter);

        if (dist < closestDist) {
            closestDist = dist;
            closest = index + 1; // minutes = index+1
        }
    });

    return closest;
}

/**************************************************
 * 3) Scroll handler (snap after user stops scrolling)
 **************************************************/
let scrollTimeout = null;

wheelContainer.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);

    scrollTimeout = setTimeout(() => {
        snapToClosest();
    }, 80);
});

/**************************************************
 * 4) Smooth snap to closest item
 **************************************************/
function snapToClosest() {
    let items = [...wheelElement.children];

    let containerRect = wheelContainer.getBoundingClientRect();
    let containerCenter = containerRect.top + containerRect.height / 2;

    let closestItem = null;
    let closestDistance = Infinity;

    items.forEach((item) => {
        let rect = item.getBoundingClientRect();
        let itemCenter = rect.top + rect.height / 2;
        let dist = Math.abs(containerCenter - itemCenter);

        if (dist < closestDistance) {
            closestDistance = dist;
            closestItem = item;
        }
    });

    if (!closestItem) return;

    let scrollTo =
        closestItem.offsetTop -
        (wheelContainer.clientHeight / 2 - closestItem.clientHeight / 2);

    wheelContainer.scrollTo({
        top: scrollTo,
        behavior: 'smooth',
    });

    let selected = getCenteredValue();
    updateMinutesFromWheel(selected);
}

/**************************************************
 * 5) Set initial minute (default: 30)
 **************************************************/
function setInitialMinute(min) {
    let items = [...wheelElement.children];
    let target = items[min - 1];

    let scrollTo =
        target.offsetTop -
        (wheelContainer.clientHeight / 2 - target.clientHeight / 2);

    wheelContainer.scrollTo({ top: scrollTo, behavior: 'instant' });

    updateMinutesFromWheel(min);
}

/* Set default minute */
setTimeout(() => setInitialMinute(30), 20);
