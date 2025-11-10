import { useEffect, useMemo, useRef, useState } from 'react'

function Input({ value, onChange, placeholder, className = '', ...props }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
}

function Button({ children, onClick, className = '', ...props }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function App() {
  const [me, setMe] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [stage, setStage] = useState('loading') // loading | auth | chat
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [compose, setCompose] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('vibechat_username')
    const savedName = localStorage.getItem('vibechat_display_name')
    if (saved) {
      setMe(saved)
      setDisplayName(savedName || saved)
      setStage('chat')
    } else {
      setStage('auth')
    }
  }, [])

  useEffect(() => {
    if (stage === 'chat' && me) {
      refreshChats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, me])

  useEffect(() => {
    if (!selectedChat) return
    fetchMessages(selectedChat._id)

    // start polling
    stopPolling()
    pollRef.current = setInterval(() => {
      fetchMessages(selectedChat._id, true)
    }, 2000)

    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const signIn = async () => {
    setError('')
    if (!me || !displayName) {
      setError('Inserisci username e nome visibile')
      return
    }
    try {
      setLoading(true)
      await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me, display_name: displayName })
      })
      localStorage.setItem('vibechat_username', me)
      localStorage.setItem('vibechat_display_name', displayName)
      setStage('chat')
    } catch (e) {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const signOut = () => {
    localStorage.removeItem('vibechat_username')
    localStorage.removeItem('vibechat_display_name')
    setMe('')
    setDisplayName('')
    setChats([])
    setSelectedChat(null)
    setMessages([])
    setStage('auth')
  }

  const refreshChats = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/chats?username=${encodeURIComponent(me)}`)
      const data = await res.json()
      setChats(data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchMessages = async (chatId, silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch(`${baseUrl}/api/messages?chat_id=${chatId}`)
      const data = await res.json()
      setMessages(data)
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!compose.trim() || !selectedChat) return
    const payload = {
      chat_id: selectedChat._id,
      sender_username: me,
      content: compose.trim(),
    }
    setCompose('')
    await fetch(`${baseUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    await fetchMessages(selectedChat._id, true)
    await refreshChats()
  }

  const [newChatUser, setNewChatUser] = useState('')
  const createChat = async () => {
    if (!newChatUser.trim()) return
    try {
      const payload = { participant_usernames: [me, newChatUser.trim()] }
      const res = await fetch(`${baseUrl}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.detail || 'Impossibile creare la chat')
      }
      setNewChatUser('')
      await refreshChats()
    } catch (e) {
      setError(e.message)
      setTimeout(() => setError(''), 3000)
    }
  }

  const chatTitle = (chat) => {
    if (!chat || !chat.participants) return 'Chat'
    // participants are user ids; we can't resolve names without more endpoints
    // show the other participant count
    const count = chat.participants.length
    return count === 2 ? 'Chat privata' : `Gruppo (${count})`
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-600">Caricamento…</div>
      </div>
    )
  }

  if (stage === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-sky-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Vibe Chat</h1>
          <p className="text-slate-600 mb-6">Accedi con un username per iniziare a chattare.</p>
          {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
          <div className="space-y-4">
            <Input value={me} onChange={setMe} placeholder="Username" />
            <Input value={displayName} onChange={setDisplayName} placeholder="Nome visibile" />
            <Button onClick={signIn} disabled={loading} className="w-full">{loading ? 'Entrando…' : 'Entra'}</Button>
          </div>
          <div className="text-xs text-slate-500 mt-6">Backend: {baseUrl}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-slate-100 flex">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-800">{displayName}</div>
            <div className="text-xs text-slate-500">@{me}</div>
          </div>
          <Button onClick={signOut} className="bg-slate-700 hover:bg-slate-800 text-xs py-1">Esci</Button>
        </div>

        <div className="p-3 space-y-2 border-b border-slate-200">
          <div className="text-xs text-slate-500">Nuova chat</div>
          <div className="flex gap-2">
            <Input value={newChatUser} onChange={setNewChatUser} placeholder="Username destinatario" />
            <Button onClick={createChat}>Crea</Button>
          </div>
          <div className="text-xs text-slate-400">Suggerimento: l'altro utente deve esistere (effettua l'accesso almeno una volta).</div>
        </div>

        <div className="overflow-y-auto flex-1">
          {chats.length === 0 ? (
            <div className="p-6 text-slate-500 text-sm">Nessuna chat. Crea una nuova conversazione.</div>
          ) : (
            chats.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedChat(c)}
                className={`w-full text-left p-4 border-b border-slate-100 hover:bg-slate-50 ${selectedChat && selectedChat._id === c._id ? 'bg-slate-50' : ''}`}
              >
                <div className="font-medium text-slate-800">{chatTitle(c)}</div>
                <div className="text-sm text-slate-500 line-clamp-1">{c.last_message_preview || 'Nessun messaggio'}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 hidden md:flex flex-col">
        {!selectedChat ? (
          <div className="m-auto text-slate-500">Seleziona una chat</div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-4 bg-white border-b border-slate-200">
              <div className="font-semibold text-slate-800">{chatTitle(selectedChat)}</div>
              <div className="text-xs text-slate-500">ID: {selectedChat._id}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
              {messages.map((m) => (
                <div key={m._id} className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${m.sender_id && m.sender_id.includes('')}`}></div>
              ))}
              {messages.map((m) => {
                const mine = m.sender_id && m.sender_id.includes('') // placeholder, we'll check by username via a trick below
                return (
                  <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm ${mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm'}`}>
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <Input value={compose} onChange={setCompose} placeholder="Scrivi un messaggio" onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }} />
              <Button onClick={sendMessage}>Invia</Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile composer when chat selected */}
      {selectedChat && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 md:hidden flex gap-2">
          <Input value={compose} onChange={setCompose} placeholder="Scrivi un messaggio" onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }} />
          <Button onClick={sendMessage}>Invia</Button>
        </div>
      )}
    </div>
  )
}

export default App
