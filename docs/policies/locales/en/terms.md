<!--
  en 번역판 — [ISSUE-12]. 정본 = docs/policies/terms.md (한국어판).
  기한·수량·관할의 숫자와 조건은 축자로 옮긴다 — 번역가 재량 0.
  ko 정본이 개정되면 이 판을 재전파하고 아래 정본 해시를 갱신한다 — 가드가 둘의 일치를 잰다.
  ⛔ 머리말에 「버전:」·「시행일:」 기계 줄을 넣지 않는다 — 메타의 출처는 ko 정본 하나다.
  정본 해시: sha256:27afa2bd42cc36d4424122ef2aed5a98f9e9cab082a93e704f6672bcda0fd1a2
-->

# Terms of Service

**graduand — Moayo Inc. (주식회사 모아요)**

> The official version of this document is the Korean version. If this translation and the Korean version differ in interpretation, the Korean version prevails.

## Article 1 (Purpose and definitions)

① The purpose of these terms is to set out the rights, the duties and the responsibilities between Moayo Inc. (the "Company") and customers with regard to the use of graduand (the "Service") provided by the Company.

② The words used in these terms have the meanings below.

1. **Verifier** — the public software module that reads rule declarations and judges the work an agent has produced.
2. **Rule declaration** — the declaration a customer keeps in its own repository, which is the standard the judgment is made against.
3. **Repository** — the customer's code repository, the unit of subscription quantity.
4. **Customer** — a corporation or business entity that has purchased a paid subscription to the Service.
5. **Seller** — the Merchant of Record designated by the Company (Article 6).

## Article 2 (Scope and formation of the contract)

① Paid subscriptions to the Service are **sold only to customers that are corporations or business entities.** Business status is confirmed at checkout, and purchases in a personal capacity are not accepted.

② In a paid subscription, the customer faces two parties — **the party to the sale is the Seller** (Article 6), and **the party providing the Service is the Company.** Payment, invoices, taxes and the execution of refunds are the Seller's part; the content and quality of the Service are the Company's part.

③ The subscription contract is formed when the customer agrees to these terms on the payment screens and completes checkout.

④ The free scope (the diagnosis) can be used without a contract; the articles of these terms on the boundaries of the Service and on liability (Articles 3 and 9) apply to that use.

## Article 3 (Content and boundaries of the Service)

① The Service judges the work an agent has produced against the rule declarations the customer holds as code.

② **The judgment runs in the customer's CI (continuous integration) environment.** The Service is not a model in which the Company receives the customer's code and judges it on the Company's infrastructure.

③ **The Company's infrastructure does not read the customer's repositories.** The Company does not accept repository access tokens or secrets from the customer, and the results of the judgment are not transmitted outside the customer's environment.

④ Judgment reports speak in three states — violation, pass, and not judged. What could not be judged is not displayed as "no problem".

⑤ The Company may change or improve the content of the Service. A material change unfavorable to customers is announced in the way set out in Article 11.

## Article 4 (Billing)

① The billing unit of a subscription is the **repository**, and the quantity is the number the customer declares. The minimum quantity is 1 and there is no upper limit. Neither the Company nor the Seller counts the customer's repositories — the quantity is based on the customer's declaration.

② The billing cycle is monthly or yearly.

③ The price of the subscription and taxes are **shown on the payment screens.** These terms do not state amounts; the amount shown on the payment screens at the time of payment is the basis of the charge.

④ When prices change, existing subscriptions keep their existing conditions. Where a change must be applied to an existing subscription, notice is given before the next renewal.

## Article 5 (Quantity changes)

① Increases and decreases of the subscription quantity (the number of repositories) are handled by request to the Company.

② The settlement amount arising from a change is not charged separately at once; it is **reflected in the next regular invoice.**

③ A reduction of quantity is neither a cancellation nor a refund — the Refund Policy, Section 4, states the same.

## Article 6 (The Seller)

① The seller of paid transactions is the Merchant of Record designated by the Company (Polar). Payment, invoices, taxes and the execution of refunds follow the Seller's terms and refund policy presented on the payment screens, and the rights that applicable law guarantees to customers remain unaffected by this.

② The Seller's corporate details are stated on the payment screens and in the tables of the Privacy Policy.

## Article 7 (Cancellation)

① The customer may cancel the subscription at any time.

② Upon cancellation, the next renewal is stopped, and the paid scope remains available **until the end of the period already paid for.** Use of the paid scope ends from that day.

③ Before the end of the paid period arrives, the cancellation can be reversed.

④ After cancellation, the rule declarations and judgment records in the customer's repositories remain the customer's — they are not in a place the Company could take or delete (Article 3 ③).

⑤ This article states only the conditions of cancellation. The channel for cancellation and refund requests is stated in the Refund Policy, Section 6 ("Where you change the subscription").

## Article 8 (Customer obligations)

① The customer is responsible for keeping its rule declarations accurate. The judgment is made against the rules the customer has declared, and if the declaration is wrong, the judgment inherits that wrongness.

② **The customer must not provide repository access tokens or secrets to the Company.** No screen or path of the Service asks for them, and a screen that appears to ask for them is not the Service.

③ The customer keeps its declared subscription quantity in line with the number of repositories actually used.

④ The customer must not disrupt the operation of the Service or abuse security vulnerabilities.

## Article 9 (Limitation of liability)

① The judgment is a mechanical judgment against the rules the customer has declared; it is not a warranty of the legality, security or quality of the work products. The Company is not liable for the consequences of decisions made on the basis of judgment results (including passes).

② The Company is not liable for damage caused by events beyond its control, such as natural disasters or failures of common telecommunications carriers.

③ As to the scope provided free of charge, the Company is not liable in the absence of its intent or gross negligence.

④ To the extent permitted by applicable law, the Company's liability regarding the paid scope is limited to the amount the customer paid for the subscription period in which the damage occurred.

⑤ This article applies only to the extent permitted by applicable law.

## Article 10 (Governing law and jurisdiction)

① The law of the Republic of Korea applies to these terms and to the use of the Service.

② Disputes related to the use of the Service are brought before the court with jurisdiction under the Civil Procedure Act.

③ The protection guaranteed by the mandatory rules of the customer's place of residence or establishment is not limited by this article.

## Article 11 (Amendment)

① The Company may amend these terms within the limits of applicable law.

② When the Company amends these terms, it announces the content of the amendment and its effective date on the surface where this document is published, **at least 7 days before it takes effect.** For an amendment unfavorable to customers or material, it announces **at least 30 days before** it takes effect and also notifies subscribing customers by email.

③ The Company keeps earlier versions so that customers can check them at any time.

## Addendum

The effective date of these terms (version 1.0) has not yet been set — on the day payments open, the effective date will be set, stated here, and kept one-to-one with the header.
