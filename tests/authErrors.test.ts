import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { authErrorKey, isEmailNotConfirmed, EMAIL_NOT_CONFIRMED, TOO_MANY_EMAILS, WAIT_A_MINUTE } from '../src/lib/authErrors.ts'

test('a log-in before the email is confirmed is recognised', () => {
  assert.equal(isEmailNotConfirmed(new Error('Email not confirmed')), true)
  assert.equal(isEmailNotConfirmed(new Error('Invalid login credentials')), false)
  assert.equal(isEmailNotConfirmed(null), false)
  assert.equal(authErrorKey(new Error('Email not confirmed'), 'Could not log in'), EMAIL_NOT_CONFIRMED)
})

test('the email limits get a plain message instead of the raw one', () => {
  assert.equal(authErrorKey(new Error('email rate limit exceeded'), 'x'), TOO_MANY_EMAILS)
  assert.equal(authErrorKey(new Error('Email rate limit exceeded'), 'x'), TOO_MANY_EMAILS)
  assert.equal(authErrorKey(new Error('For security purposes, you can only request this after 42 seconds.'), 'x'), WAIT_A_MINUTE)
})

test('other errors keep their own text, and an empty one gets the fallback', () => {
  assert.equal(authErrorKey(new Error('User already registered'), 'Could not create account'), 'User already registered')
  assert.equal(authErrorKey(new Error(''), 'Could not create account'), 'Could not create account')
  assert.equal(authErrorKey(undefined, 'Could not log in'), 'Could not log in')
})

test('each of the plain messages has a translation', () => {
  const dictionary = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8')
  for (const key of [EMAIL_NOT_CONFIRMED, TOO_MANY_EMAILS, WAIT_A_MINUTE]) {
    assert.ok(dictionary.includes(`'${key}': [`), key)
  }
})
