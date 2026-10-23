/** Upstream dollar math, except that a dollar glued to a word on its left never opens inline math. */

import { math } from 'micromark-extension-math'
import { codes } from 'micromark-util-symbol'
import type { Construct, Extension, Previous } from 'micromark-util-types'

const wordCharacter = /[\p{L}\p{N}]/u

function isWordCharacter(code: number | null): boolean {
  return code !== null && code >= 0 && wordCharacter.test(String.fromCodePoint(code))
}

/**
 * The math extension with a stricter opener for single-dollar inline math.
 *
 * Currency symbols are written with the dollar glued to a word: `R$ 1.566`,
 * `US$ 20`, `(R$ 9.428)`. Two of them in one paragraph would otherwise pair up
 * as an inline formula and render the prose between them in math italics.
 * TeX openers are not written that way — `$x$` follows a space, punctuation or
 * the line start — so refusing an opener whose previous character is a letter
 * or digit keeps currency literal without giving up `$...$`. The closing dollar
 * is untouched: the tokenizer finds it while scanning, never through this check.
 * @returns The micromark extension, a drop-in replacement for `math()`.
 */
export function dollarMath(): Extension {
  const extension = math()
  const construct = extension.text?.[codes.dollarSign] as Construct | undefined
  const upstream = construct?.previous
  if (construct === undefined || upstream === undefined) {
    throw new Error('micromark-extension-math no longer exposes its inline construct')
  }
  const previous: Previous = function (code) {
    return upstream.call(this, code) && !isWordCharacter(code)
  }
  return { ...extension, text: { ...extension.text, [codes.dollarSign]: { ...construct, previous } } }
}
