/**
 * 문의 모달 — ⭐⭐ **조립기다. 아무것도 보내지 않는다.**
 *
 * ⭐⭐ **왜 조립기인가.** 폼이 제출할 자리가 이 제품에 **없다**: 이 배포에 워커 스크립트가
 * 0 이고(`wrangler.jsonc`), 화면 코드에 네트워크 원시가 0 이고(`boundary.test.ts`), 밖으로
 * 나가는 주소도 0 이다. 그 셋 중 하나를 열어 제출을 받으면 ⑴ 문의 내용이 **우리 서버를
 * 지나고** ⑵ 그러면 처리방침의 수집 경로·항목이 움직이고 ⑶ 그 변경은 **시행 7일 전 고지**를
 * 끌고 온다. ⇒ 셋 다 열지 않고, 대신 **메일 앱이 받을 주소를 조립**한다. 보내는 것은
 * 방문자의 메일 앱이고, 우리는 **받기만** 한다(이미 공개된 법정 게시의 문의 주소로).
 * ⇒ 처리방침이 한 칸도 움직이지 않는다 — 그것이 이 설계를 고른 **이유**다.
 *
 * ⭐ **자매 제품이 같은 결정을 먼저 했다** — 빌린 것은 **문제 정의와 결정**이고 코드는
 * 공유하지 않는다(제품마다 자구와 가드가 다르다).
 *
 * ⭐⭐ **제출은 버튼이 아니라 진짜 `<a>` 다.** 눌러서 스크립트가 주소를 바꾸는 꼴
 * (`location` 대입)로 두면 화면 코드가 **이동을 쥐게** 되고, 그것이 이 패키지가 금칙으로
 * 둔 자리다. 링크는 브라우저가 이동을 쥔다 — 가운데 클릭도, 복사도 그대로 된다.
 *
 * ⭐⭐ **주소를 이 파일이 쥐지 않는다 — 트리거의 `href` 에서 읽는다.** 그 값은 법정 게시의
 * 문의와 **같은 한 손**(`publisher.ts`)에서 났고, 여기 리터럴로 적으면 사본이 하나 늘어
 * 게시된 주소와 조립되는 주소가 **갈라질 수 있다**(그 갈라짐은 화면에 아무 표시도 남기지
 * 않는다 — 방문자만 다른 데로 메일을 보낸다).
 *
 * ⭐ **자구도 쥐지 않는다 — `data-…` 에서 읽는다.** 카탈로그 두 벌이 정본이고 발행본이
 * 그것을 나른다. 스크립트에 문자열을 적으면 로케일 하나가 조용히 번역되지 않는다.
 *
 * ⚠️⚠️ **빠뜨리면 던지지 않고 그냥 돌아간다 — 그 침묵에는 근거가 있다.** 이 패키지의 다른
 * 배선은 선언된 자리가 없으면 **던진다**(`must`). 여기서 그 규율을 쓰지 않는 이유는 ⑴ 이
 * 자리는 **크롬**이고 발행본에 서 있는지는 **가드가 센다**(`contact-modal.test.ts` 가
 * 문서 × 로케일 전수에서 트리거와 자구 전수를 묻는다) ⑵ 던지면 이 모듈을 가져오는 **페이지
 * 전체의 배선이 죽는다** — 푸터의 문의 한 줄 때문에 진단 입구가 함께 멎는다. ⇒ 「조용히
 * 지나간다」가 위험한 것은 **아무도 보지 않을 때**이고, 여기는 가드가 본다.
 */

/**
 * 트리거 — 크롬 한 벌이 **모든 문서**에 세운다. ⛔ 문서마다 다른 선택자를 두지 않는다
 * (푸터가 한 벌이라 자리도 한 벌이다).
 */
export const TRIGGER_SELECTOR = 'a.contact-trigger';

/**
 * 모달이 묻는 칸 **전수** — ⭐⭐ **둘이고, 이 열거가 정본이다**(카탈로그도 템플릿도 수를
 * 적지 않는다).
 *
 * ⛔ **발신자 칸이 없다.** 이름도 회신 주소도 묻지 않는다 — 보내는 것이 방문자의 메일 앱이라
 * 그 둘은 **메일 앱이 이미 안다**. 물으면 같은 값을 두 번 받는 꼴이고, 그것은 처리방침 §8 이
 * 첫 조치로 적은 「수집 최소화의 구조」와 정면으로 어긋난다.
 * ⛔ 비밀번호 칸·토큰 칸은 이 제품의 어느 화면에도 0 이다 — 가드가 양쪽에서 문다.
 */
export const CONTACT_FIELDS = ['subject', 'body'] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

/**
 * 트리거가 나르는 자구의 `data-…` 이름 — ⭐ 키 하나가 자리 하나다. 가드가 이 열거로
 * 발행본을 돌므로, 자구를 더하려면 **여기와 카탈로그와 템플릿이 함께** 움직인다.
 */
export const LABEL_KEYS = ['title', 'lede', 'subject', 'body', 'submit', 'close'] as const;

export type LabelKey = (typeof LABEL_KEYS)[number];

export type Labels = Readonly<Record<LabelKey, string>>;

/** `data-contact-<이름>` — ⛔ 이름을 두 번 적지 않는다(이 한 손이 가드와 배선 둘 다 쓴다). */
export const dataAttr = (key: LabelKey): string => `data-contact-${key}`;

/**
 * 네이티브 모달을 쓸 수 있는가 — ⭐ **`<dialog>` 가 아니라 `showModal` 을 묻는다**: 요소는
 * 알면서 모달 열기를 모르는 판이 있었고, 요소만 보고 가로채면 그 브라우저에서 **눌리는데
 * 아무 일도 일어나지 않는** 링크가 된다(그 사고가 바로 「죽은 컨트롤」이다).
 */
export const canOpenModal = (view: typeof globalThis = globalThis): boolean =>
  typeof (view as { HTMLDialogElement?: { prototype?: { showModal?: unknown } } }).HTMLDialogElement
    ?.prototype?.showModal === 'function';

/**
 * 조립 — ⭐ **빈 칸은 질의를 만들지 않는다.** 둘 다 비면 트리거의 그 주소가 **그대로** 나가고,
 * 그것이 폼이 들어오기 전과 같은 결과다(빈 `subject=` 를 붙여 메일 앱에 빈 제목을 주지 않는다).
 */
export function composeMailto(base: string, values: Readonly<Record<ContactField, string>>): string {
  const query = CONTACT_FIELDS.filter((field) => values[field].trim() !== '')
    .map((field) => `${field}=${encodeURIComponent(values[field])}`)
    .join('&');
  return query === '' ? base : `${base}?${query}`;
}

/** 트리거가 든 자구 전수 — ⛔ 하나라도 비면 조립하지 않는다(말 없는 칸을 열지 않는다). */
export function labelsOf(trigger: Element): Labels | null {
  const found: Partial<Record<LabelKey, string>> = {};
  for (const key of LABEL_KEYS) {
    const value = trigger.getAttribute(dataAttr(key));
    if (value === null || value === '') return null;
    found[key] = value;
  }
  return found as Labels;
}

/**
 * 배선 — 트리거 하나를 모달로 바꾼다. ⭕ 되돌릴 수 있는 꼴이다: 모달을 만들지 못하면
 * 손대지 않고 돌아가므로 트리거는 **평 `mailto:` 링크** 그대로 남는다.
 */
export function wireContactModal(doc: Document = document): void {
  const trigger = doc.querySelector<HTMLAnchorElement>(TRIGGER_SELECTOR);
  if (trigger === null) return;
  if (!canOpenModal()) return;

  const labels = labelsOf(trigger);
  if (labels === null) return;

  // ⭐ 주소의 출처는 **이 링크**다 — 리터럴을 두면 게시된 주소와 갈라질 수 있다.
  const base = trigger.getAttribute('href');
  if (base === null || base === '') return;

  const dialog = doc.createElement('dialog');
  dialog.className = 'contact-modal';

  const heading = doc.createElement('h2');
  heading.className = 'contact-modal-h';
  heading.textContent = labels.title;
  const headingId = 'contact-modal-title';
  heading.id = headingId;
  dialog.setAttribute('aria-labelledby', headingId);

  const lede = doc.createElement('p');
  lede.className = 'contact-modal-lede';
  lede.textContent = labels.lede;

  dialog.append(heading, lede);

  // ⭐ 칸은 선언이 분모다 — `CONTACT_FIELDS` 가 그 열거이고, 라벨은 같은 이름으로 찾는다.
  const inputs: Record<ContactField, HTMLInputElement | HTMLTextAreaElement> = {
    subject: doc.createElement('input'),
    body: doc.createElement('textarea'),
  };
  inputs.subject.setAttribute('type', 'text');

  for (const field of CONTACT_FIELDS) {
    const row = doc.createElement('p');
    row.className = 'contact-modal-row';
    const label = doc.createElement('label');
    const control = inputs[field];
    control.id = `contact-${field}`;
    control.name = field;
    label.setAttribute('for', control.id);
    label.textContent = labels[field];
    row.append(label, control);
    dialog.append(row);
  }

  // ⭐⭐ 제출은 **링크**다 — 이동을 브라우저가 쥔다(화면 코드가 쥐지 않는다).
  const submit = doc.createElement('a');
  submit.className = 'contact-modal-submit';
  submit.textContent = labels.submit;
  submit.setAttribute('href', base);

  const close = doc.createElement('button');
  close.className = 'contact-modal-close';
  close.setAttribute('type', 'button');
  close.textContent = labels.close;

  const actions = doc.createElement('p');
  actions.className = 'contact-modal-actions';
  actions.append(submit, close);
  dialog.append(actions);

  const refresh = (): void => {
    submit.setAttribute(
      'href',
      composeMailto(base, { subject: inputs.subject.value, body: inputs.body.value }),
    );
  };
  for (const field of CONTACT_FIELDS) inputs[field].addEventListener('input', refresh);

  close.addEventListener('click', () => dialog.close());
  // ⭐ 포커스를 **돌려준다** — 네이티브가 트랩·ESC·백드롭을 지고, 우리가 더하는 것은 이 한 줄이다.
  dialog.addEventListener('close', () => trigger.focus());

  doc.body.append(dialog);

  trigger.addEventListener('click', (event) => {
    // ⛔ 가로채기는 **열 수 있을 때만** 한다 — 못 열면 기본 동작(메일 앱)이 그대로 간다.
    event.preventDefault();
    refresh();
    dialog.showModal();
  });
}
