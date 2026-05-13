export class PolaroidPopup {
  constructor(uiLayer) {
    this.el = uiLayer;
  }

  showBloom(skillLabel, bloomStory) {
    this._show(`${skillLabel} bloomed!`, bloomStory, 'bloom');
  }

  showFlush(item) {
    const categoryEmoji = {
      fish: '🐟', polaroid: '📸', note: '📝',
      wardrobe: '🧣', question: '❓', surprise: '✨',
    };
    const emoji = categoryEmoji[item.category] || '💫';
    this._show(emoji, item.text, 'flush');
  }

  _show(title, body, type) {
    const popup = document.createElement('div');
    popup.className = `polaroid-popup polaroid-${type}`;
    popup.innerHTML = `
      <div class="polaroid-card">
        <div class="polaroid-title">${title}</div>
        <div class="polaroid-body">${body}</div>
      </div>
    `;
    popup.style.pointerEvents = 'auto';
    this.el.appendChild(popup);

    setTimeout(() => popup.classList.add('polaroid-visible'), 10);
    setTimeout(() => {
      popup.classList.remove('polaroid-visible');
      popup.classList.add('polaroid-exit');
      setTimeout(() => popup.remove(), 500);
    }, 3000);
  }
}
