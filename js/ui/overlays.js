export class Overlays {
  constructor() {
    this.el = document.getElementById('ui-layer');
    this.overlay = null;
    this.entryMode = false;
    this.data = { projects: [], skills: {}, about: {} };
    this.loadData();
  }

  async loadData() {
    try {
      const [projects, skills, about] = await Promise.all([
        fetch('/data/projects.json').then(r => r.json()),
        fetch('/data/skills.json').then(r => r.json()),
        fetch('/data/about.json').then(r => r.json()),
      ]);
      this.data = { projects, skills, about };
    } catch (e) {
      console.warn('Failed to load data:', e);
    }
  }

  isOpen() { return this.overlay !== null; }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.entryMode = false;
    }
  }

  _createPanel(title, content) {
    this.close();
    const panel = document.createElement('div');
    panel.className = 'overlay-panel';
    panel.innerHTML = `
      <div class="overlay-inner">
        <h2>${title}</h2>
        <div class="overlay-content">${content}</div>
        <p class="overlay-hint">[E] to close</p>
      </div>
    `;
    panel.style.pointerEvents = 'auto';
    this.el.appendChild(panel);
    this.overlay = panel;
  }

  openSkills() {
    const { skills, projects } = this.data;
    let html = '';
    for (const [key, skill] of Object.entries(skills)) {
      const count = skill.projects ? skill.projects.length : 0;
      const names = (skill.projects || [])
        .map(slug => {
          const p = projects.find(pr => pr.slug === slug);
          return p ? p.title : slug;
        })
        .join(', ');
      html += `<div class="skill-item">
        <strong>${skill.label}</strong> <span class="skill-count">(${count} projects)</span>
        <div class="skill-projects">${names}</div>
      </div>`;
    }
    this._createPanel('Skills', html);
  }

  openAbout() {
    const { about } = this.data;
    const html = `
      <p><strong>${about.name || 'Kay Xia'}</strong></p>
      <p>${about.program || ''}</p>
      <p class="about-bio">${about.bio || ''}</p>
      <p class="about-philosophy">${about.philosophy || ''}</p>
    `;
    this._createPanel('About', html);
  }

  openContact() {
    const { about } = this.data;
    const html = `
      <p>${about.email ? `<a href="mailto:${about.email}">${about.email}</a>` : ''}</p>
      <p>${about.linkedin ? `<a href="${about.linkedin}" target="_blank">LinkedIn</a>` : ''}</p>
    `;
    this._createPanel('Contact', html);
  }

  openEntry(onComplete) {
    const html = `
      <p class="entry-prompt">what's your name, stranger?</p>
      <input type="text" class="entry-input" placeholder="type here..." maxlength="20">
      <button class="entry-btn">enter the dream</button>
    `;
    this._createPanel('welcome', html);
    this.entryMode = true;

    const input = this.overlay.querySelector('.entry-input');
    const btn = this.overlay.querySelector('.entry-btn');
    input.focus();

    const submit = () => {
      const name = input.value.trim() || 'stranger';
      this.close();
      if (onComplete) onComplete(name);
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
    });
  }
}
