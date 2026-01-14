const state = {
  config: null,
  currentStepId: null,
  data: {},
  verdict: '',
  isPaid: false
};

const appEl = document.getElementById('card');

function setContent(node) {
  appEl.innerHTML = '';
  appEl.appendChild(node);
}

function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.className) {
    el.className = options.className;
  }
  if (options.text) {
    el.textContent = options.text;
  }
  return el;
}

function getStep(id) {
  return state.config.flow.steps.find((step) => step.id === id);
}

function updateQuery(stepId) {
  const url = new URL(window.location.href);
  url.searchParams.set('step', stepId);
  if (state.isPaid) {
    url.searchParams.set('paid', '1');
  }
  window.history.replaceState({}, '', url);
}

function navigateTo(stepId) {
  state.currentStepId = stepId;
  updateQuery(stepId);
  renderStep();
}

function createButton(label, className, onClick) {
  const button = createElement('button', { text: label, className });
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

function renderBullets(items) {
  const list = createElement('ul', { className: 'bullets' });
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  return list;
}

function renderScreen(step) {
  const wrapper = document.createElement('div');
  const title = createElement('h1', { text: step.title });
  wrapper.appendChild(title);

  if (step.subtitle) {
    wrapper.appendChild(createElement('p', { text: step.subtitle, className: 'subtitle' }));
  }

  step.components.forEach((component) => {
    if (component.type === 'bullets') {
      wrapper.appendChild(renderBullets(component.items));
    }

    if (component.type === 'cta') {
      const actions = createElement('div', { className: 'actions' });
      actions.appendChild(
        createButton(component.label, 'primary', () => handleAction(component.action))
      );
      wrapper.appendChild(actions);
    }

    if (component.type === 'cta_row') {
      const actions = createElement('div', { className: 'actions' });
      component.buttons.forEach((buttonConfig, index) => {
        const style = index === 0 ? 'primary' : 'secondary';
        actions.appendChild(
          createButton(buttonConfig.label, style, () => handleAction(buttonConfig.action))
        );
      });
      wrapper.appendChild(actions);
    }

    if (component.type === 'markdown') {
      const verdict = createElement('div', { className: 'verdict' });
      verdict.textContent = state.verdict || component.source || '';
      wrapper.appendChild(verdict);
    }
  });

  return wrapper;
}

function validateField(key, value) {
  const rules = {
    monthly_ad_spend: { min: 0.01 },
    timeframe_days: { min: 3, max: 90 },
    ctr_all: { min: 0, max: 20 },
    cost_per_result: { min: 0.01 }
  };

  if (rules[key]) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return 'Please enter a valid number.';
    }
    if (rules[key].min !== undefined && numericValue < rules[key].min) {
      return `Must be at least ${rules[key].min}.`;
    }
    if (rules[key].max !== undefined && numericValue > rules[key].max) {
      return `Must be ${rules[key].max} or less.`;
    }
  }

  return '';
}

function renderForm(step) {
  const wrapper = document.createElement('div');
  wrapper.appendChild(createElement('h1', { text: step.title }));
  if (step.subtitle) {
    wrapper.appendChild(createElement('p', { text: step.subtitle, className: 'subtitle' }));
  }

  const form = document.createElement('form');

  step.fields.forEach((field) => {
    const fieldWrapper = createElement('div', { className: 'form-field' });
    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', field.key);
    fieldWrapper.appendChild(label);

    let input;
    if (field.component === 'select') {
      input = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select an option';
      input.appendChild(placeholder);

      const options = state.config.data_model.fields[field.key].options || [];
      options.forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        input.appendChild(optionEl);
      });
    } else {
      input = document.createElement('input');
      input.type = field.component === 'number' ? 'number' : 'text';
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
    }

    input.id = field.key;
    input.name = field.key;
    if (state.data[field.key]) {
      input.value = state.data[field.key];
    }

    const helper = createElement('div', { className: 'helper' });
    fieldWrapper.appendChild(input);
    fieldWrapper.appendChild(helper);
    form.appendChild(fieldWrapper);
  });

  const actions = createElement('div', { className: 'actions' });
  actions.appendChild(createButton(step.actions[0].label, 'primary', () => {}));
  form.appendChild(actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
  });

  actions.querySelector('button').addEventListener('click', async () => {
    const formData = new FormData(form);
    let hasError = false;

    step.fields.forEach((field, index) => {
      const value = formData.get(field.key);
      const helper = form.querySelectorAll('.helper')[index];

      if (field.required && !value) {
        helper.textContent = 'This field is required.';
        hasError = true;
        return;
      }

      if (value) {
        const error = validateField(field.key, value);
        if (error) {
          helper.textContent = error;
          hasError = true;
          return;
        }
      }

      helper.textContent = '';
    });

    if (hasError) {
      return;
    }

    step.fields.forEach((field) => {
      const value = formData.get(field.key);
      if (value) {
        state.data[field.key] = value;
      }
    });

    navigateTo('verdict_ai');
    await fetchVerdict();
  });

  wrapper.appendChild(form);
  return wrapper;
}

function renderPayment(step) {
  const wrapper = document.createElement('div');
  wrapper.appendChild(createElement('h1', { text: step.title }));
  if (step.description) {
    wrapper.appendChild(createElement('p', { text: step.description, className: 'subtitle' }));
  }

  const notice = createElement('div', { className: 'notice' });
  notice.textContent = `${step.pricing.currency} ${step.pricing.amount}`;
  wrapper.appendChild(notice);

  const actions = createElement('div', { className: 'actions' });
  const payButton = createButton('Pay & Start', 'primary', async () => {
    payButton.disabled = true;
    payButton.textContent = 'Redirecting…';
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      payButton.disabled = false;
      payButton.textContent = 'Pay & Start';
      alert('Unable to start checkout. Please try again.');
      return;
    }

    const data = await response.json();
    window.location.href = data.url;
  });

  const cancelButton = createButton('Cancel', 'secondary', () => navigateTo('exit'));

  actions.appendChild(payButton);
  actions.appendChild(cancelButton);
  wrapper.appendChild(actions);

  return wrapper;
}

function renderLoading(step) {
  const wrapper = document.createElement('div');
  wrapper.appendChild(createElement('h1', { text: step.title }));
  return wrapper;
}

async function fetchVerdict() {
  const response = await fetch('/api/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state.data)
  });

  if (!response.ok) {
    state.verdict = 'Something went wrong generating the verdict.';
    navigateTo('results_paid');
    return;
  }

  const data = await response.json();
  state.verdict = data.verdict;
  navigateTo('results_paid');
}

function handleAction(action) {
  if (action.type === 'next') {
    const currentIndex = state.config.flow.steps.findIndex(
      (step) => step.id === state.currentStepId
    );
    const nextStep = state.config.flow.steps[currentIndex + 1];
    if (nextStep) {
      navigateTo(nextStep.id);
    }
    return;
  }

  if (action.type === 'go_to') {
    navigateTo(action.step_id);
    return;
  }

  if (action.type === 'copy_to_clipboard') {
    navigator.clipboard.writeText(state.verdict || action.value || '');
    alert('Verdict copied to clipboard.');
  }
}

function renderStep() {
  const step = getStep(state.currentStepId);
  if (!step) {
    return;
  }

  if (step.type === 'screen') {
    setContent(renderScreen(step));
    return;
  }

  if (step.type === 'form') {
    setContent(renderForm(step));
    return;
  }

  if (step.type === 'payment') {
    setContent(renderPayment(step));
    return;
  }

  if (step.type === 'ai_call') {
    setContent(renderLoading(step));
  }
}

async function init() {
  const response = await fetch('/api/config');
  state.config = await response.json();

  const url = new URL(window.location.href);
  const stepFromQuery = url.searchParams.get('step');
  const paid = url.searchParams.get('paid');

  if (paid === '1') {
    state.isPaid = true;
  }

  state.currentStepId = stepFromQuery || state.config.flow.steps[0].id;
  renderStep();
}

init();
