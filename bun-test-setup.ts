import { JSDOM } from 'jsdom'
import '@testing-library/jest-dom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

global.window = dom.window as any
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.Text = dom.window.Text
global.getComputedStyle = dom.window.getComputedStyle