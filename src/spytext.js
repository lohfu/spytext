/**
 * A Backbone.View for Spytext fields.
 *
 * @module spytext/field
 */

import Snapback from 'snapback'

import * as selektr from 'selektr'

import { $, $$, on, off, trigger } from 'domp'
import { forEach } from 'lowline'

import SpytextToolbar from './toolbar'
import * as commands from './commands'
import * as events from './events'

/**
 * @readonly
 */
// const blockTags = [ 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI' ];

function Spytext(options) {
  this.el = $(options.el)

  this.el.classList.add('spytext-field')
  this.el.setAttribute('contentEditable', 'true')

  commands.deleteEmptyTextNodes(this.el)
  commands.deleteEmptyElements(this.el)
  if (this.el.childNodes.length === 0) {
    this.el.append($('<p>'))
  }
  commands.setBR($$(this.el.children))

  this.originalValue = this.el.innerHTML

  this.toolbar = new SpytextToolbar()

  document.body.append(this.toolbar.el)

  this.snapback = new Snapback({
    element: this.el,
    /**
     * Saves and returns the positions of the current selection
     *
     * @return {Positions}
     */
    store(data) {
      return (this.data = data || selektr.get())
    },

    restore(data) {
      this.store(data)

      selektr.set(data)
    },
  })

  forEach(this.events, (fnc, eventStr) => {
    on(this.el, eventStr, (fnc instanceof Function ? fnc : this[fnc]).bind(this))
  })
}

Object.assign(Spytext.prototype, {
  events: Object.assign(
    {
      focus: 'activate',

      blur: 'deactivate',

      input: 'input',
    },
    events,
  ),

  /**
   * Activates the current field.
   */
  activate() {
    // enable snapback, ie. tell the snapback instance's
    // mutationObserver to observer
    this.snapback.enable()

    // toggle the toolbar, passing the current field to it
    this.toolbar.toggle(this)

    selektr.setElement(this.el)

    // i think the timeout is because of the range not being initialized
    // so snapback.storePositions/selektr produces an error
    setTimeout(() => {
      this.snapback.store()

      // this is to capture events when mousedown on
      // fields element but mouseup outside
      on(document, 'mousedown', () => {
        clearTimeout(this.timeout)
        this.snapback.register()
      })

      on(document, 'mouseup', () => {
        setTimeout(() => {
          selektr.normalize()
          this.toolbar.setActiveStyles()
          this.snapback.store()
        })
      })
    })
  },

  input(e) {
    if (e.inputType === 'historyUndo') {
      document.execCommand('redo')
      // firefox does not focus element after executing the undo
      this.el.focus()
      this.snapback.undo()
    }
  },

  /**
   * Deactivates the current field.
   */
  deactivate() {
    // register mutations (if any) as an undo before deactivating
    this.snapback.register()

    // disable snapback, ie. disconnect the mutationObserver
    this.snapback.disable()

    // deactivate toolbar
    this.toolbar.toggle()

    // stop listening to mouseup and mousedown on document
    off(document, 'mouseup')
    off(document, 'mousedown')
  },

  /**
   * Calls a command from module:spytext/commands
   *
   * @see module:spytext/commands
   */
  command(command, ...args) {
    // register mutations (if any) as undo before calling command
    // so that the command becomes it's own undo without merging
    // it with any previous mutations in the mutation array in snapback
    this.snapback.register()

    if (commands[command]) {
      // call the command
      commands[command](this.el, ...args)

      // normalize any text nodes in the field's element
      this.el.normalize()

      trigger(this.el, 'input')
      // unfortunately, we need to wrap the registation of a new Undo
      // in a timeout
      setTimeout(() => {
        // register the called command as an undo
        this.snapback.register()
        this.toolbar.setActiveStyles()
      })
    }
  },
})

export default Spytext
