import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const lightTheme = {
  dark: false,
  colors: {
    background: '#fbf6ef',
    surface: '#fff8ef',
    primary: '#cc5c2d',
    secondary: '#2f5a4b',
    error: '#b53d2b',
    warning: '#b56a17'
  }
}

const darkTheme = {
  dark: true,
  colors: {
    background: '#0b0716',
    surface: '#141028',
    primary: '#8a63ff',
    secondary: '#74d3bc',
    error: '#ff7d94',
    warning: '#f4b860'
  }
}

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'lightTheme',
    themes: {
      lightTheme,
      darkTheme
    }
  }
})
