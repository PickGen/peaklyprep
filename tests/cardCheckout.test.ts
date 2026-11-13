import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCheckoutUrl, checkoutSettingKey, cleanSetting, isCheckoutLink } from '../src/lib/cardCheckout.ts'

const LINK = 'https://peaklyprep.lemonsqueezy.com/checkout/buy/d1f120fd-5adc-4fff-8915-cce713d29427'
const USER = '0b0f6f0e-6c1c-4d9e-9a51-3a2f7b1c9d10'

test('a setting saved from the admin panel loses its extra quotes', () => {
  assert.equal(cleanSetting(`"${LINK}"`), LINK)
  assert.equal(cleanSetting('  '), '')
  assert.equal(cleanSetting(null), '')
  assert.equal(checkoutSettingKey('3m'), 'ls_checkout_3m')
})

test('only an https Lemon Squeezy checkout address counts as a link', () => {
  assert.equal(isCheckoutLink(LINK), true)
  assert.equal(isCheckoutLink('https://peaklyprep.lemonsqueezy.com/buy/d1f120fd-5adc-4fff-8915-cce713d29427'), true)
  assert.equal(isCheckoutLink(LINK.replace('https:', 'http:')), false)
  assert.equal(isCheckoutLink('https://lemonsqueezy.com.evil.example/checkout/buy/1'), false)
  assert.equal(isCheckoutLink('https://peaklyprep.lemonsqueezy.com/'), false)
  assert.equal(isCheckoutLink('4400 4303'), false)
  assert.equal(isCheckoutLink(''), false)
})

test('the pay button address carries the student id and the plan, and nothing else', () => {
  const url = new URL(buildCheckoutUrl(LINK, USER, '6m')!)
  assert.equal(url.origin + url.pathname, LINK)
  assert.deepEqual([...url.searchParams.entries()], [
    ['checkout[custom][user_id]', USER],
    ['checkout[custom][plan]', '6m'],
  ])
})

test('parameters already in the link are kept', () => {
  const url = new URL(buildCheckoutUrl(`${LINK}?embed=1`, USER, '1m')!)
  assert.equal(url.searchParams.get('embed'), '1')
  assert.equal(url.searchParams.get('checkout[custom][plan]'), '1m')
})

test('no button without a link or without a signed-in student', () => {
  assert.equal(buildCheckoutUrl('', USER, '1m'), null)
  assert.equal(buildCheckoutUrl('https://example.com/buy/1', USER, '1m'), null)
  assert.equal(buildCheckoutUrl(LINK, '', '1m'), null)
})
