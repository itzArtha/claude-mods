export function register(on) {
    on('session.start', async ($, e, next) => {
        $.ui.status('👋 hello-mod loaded')
        $.command.register({ name: 'hi', description: 'Say hi' })
        return next(e)
    })

    on('command.run', async ($, e, next) => {
        if (e.name !== 'hi') return next(e)
        $.ui.toast('Hi there!')
        return { text: 'Said hi.' }
    })
}