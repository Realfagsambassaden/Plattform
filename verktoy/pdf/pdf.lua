-- Lua-filter for PDF-kompendiene: gjør nettsidens bokser om til LaTeX-miljøer (se oppsett.tex).
local function raw(s) return pandoc.RawBlock('latex', s) end
local function tekst(inl) return pandoc.write(pandoc.Pandoc({pandoc.Plain(inl)}), 'latex') end

function Div(el)
  local c = el.classes
  if c:includes('eksempel') then
    -- Tittelen er første fete tekst («Eksempel: Usain Bolt.»); den flyttes opp i boksens tittel
    local tittel = 'Eksempel'
    local forste = el.content[1]
    if forste and forste.t == 'Para' and forste.content[1] and forste.content[1].t == 'Strong' then
      local t = pandoc.utils.stringify(forste.content[1])
      if t:match('^Eksempel') then
        tittel = tekst(forste.content[1].content):gsub('[%.:]%s*$', '')
        table.remove(forste.content, 1)
        if forste.content[1] and forste.content[1].t == 'Space' then table.remove(forste.content, 1) end
        if #forste.content == 0 then table.remove(el.content, 1) end
      end
    end
    local ut = { raw('\\begin{eksempel}{' .. tittel .. '}') }
    for _, b in ipairs(el.content) do table.insert(ut, b) end
    table.insert(ut, raw('\\end{eksempel}'))
    return ut
  elseif c:includes('losning') then
    local ut = { raw('\\begin{losningdel}') }
    for _, b in ipairs(el.content) do table.insert(ut, b) end
    table.insert(ut, raw('\\end{losningdel}'))
    return ut
  elseif c:includes('oppgave') then
    local t = el.attributes['tittel'] or ''
    local nr = el.attributes['nr'] or ''
    local niva = el.attributes['niva'] or ''
    local hode = 'Oppgave ' .. nr .. (t ~= '' and (': ' .. tekst(pandoc.read(t, 'markdown').blocks[1].content)) or '')
    local ut = { raw('\\begin{oppgave}{' .. hode .. '}{' .. niva .. '}') }
    for _, b in ipairs(el.content) do table.insert(ut, b) end
    table.insert(ut, raw('\\end{oppgave}'))
    return ut
  elseif c:includes('graa') then
    local ut = { raw('\\begin{graaboks}') }
    for _, b in ipairs(el.content) do table.insert(ut, b) end
    table.insert(ut, raw('\\end{graaboks}'))
    return ut
  elseif c:includes('merk') then
    local t = el.attributes['title'] or ''
    local ut = { raw('\\begin{merkboks}{' .. (t ~= '' and tekst(pandoc.read(t, 'markdown').blocks[1].content) or '') .. '}') }
    for _, b in ipairs(el.content) do table.insert(ut, b) end
    table.insert(ut, raw('\\end{merkboks}'))
    return ut
  elseif c:includes('oppgaver') then
    return el.content
  end
end
