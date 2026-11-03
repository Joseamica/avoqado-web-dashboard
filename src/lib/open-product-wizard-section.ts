export async function openProductWizardSection(
  section: string,
  target: string,
  waitForElement: (selector: string) => Promise<Element>,
): Promise<boolean> {
  if (document.querySelector(target)) return true
  const opener = document.querySelector<HTMLButtonElement>(`[data-tour="product-wizard-add-${section}"]`)
  if (!opener || opener.disabled) return false
  opener.click()
  try {
    await waitForElement(target)
    return true
  } catch {
    return false
  }
}
