# Lager formelarket som nettside fra Bens LaTeX-kilde.
# Bruk: python3 verktoy/formelark_fra_tex.py <Formelark-TRES0312.tex> <gammel html (for hode og stil)> <ut.html>
import re,sys,html
tex=open(sys.argv[1]).read(); gammel=open(sys.argv[2]).read()
body=tex[tex.index('\\begin{multicols}'):tex.index('\\end{multicols}')]
def txt(s):
    s=s.replace('--','–').replace('\\textmu','µ').replace('\\,',' ').replace('\\ ',' ').replace('~',' ')
    s=re.sub(r'\\textbf\{(\$[^$]*\$)\}',r'<b>\1</b>',s); s=re.sub(r'\\emph\{([^}]*)\}',r'<i>\1</i>',s); s=re.sub(r'\\textbf\{([^}]*)\}',r'<b>\1</b>',s)
    # escape outside $...$
    deler=re.split(r'(\$[^$]*\$)',s); return ''.join(d if d.startswith('$') else d.replace('<b>','\0b').replace('</b>','\1b').replace('<i>','\0i').replace('</i>','\1i').replace('&','&amp;').replace('<','&lt;').replace('\0b','<b>').replace('\1b','</b>').replace('\0i','<i>').replace('\1i','</i>') for d in deler).strip()
def rader(blokk):
    ut=[]; ventende=None
    for r in [x.strip() for x in blokk.split('\\\\') if x.strip()]:
        f,_,h=r.partition('&'); f=f.strip(); h=h.strip()
        m=re.match(r'\\multirow\{(\d+)\}\{=\}\{(.*)\}$',h,re.S)
        if m: n=int(m.group(1)); h=m.group(2); ventende=[n,txt(h),[f]]; 
        elif ventende: ventende[2].append(f)
        else: ut.append((f,txt(h)))
        if ventende and len(ventende[2])==ventende[0]:
            ut.append((' \\\\ '.join(ventende[2]) if len(ventende[2])>1 else ventende[2][0], ventende[1], len(ventende[2])>1)); ventende=None
    return ut
def formel(f,fler=False):
    f=f.replace('\\textstyle','').strip()
    return '$\\begin{gathered}'+f+'\\end{gathered}$' if fler else '$\\displaystyle '+f+'$'
def tabell(l):
    o=['      <table>']
    for t in l:
        f,h=t[0],t[1]; fler=len(t)>2 and t[2]
        o.append(f'        <tr><td class="f">{formel(f,fler)}</td><td class="h">{h}</td></tr>')
    o.append('      </table>'); return '\n'.join(o)
seksjoner=re.findall(r'\\begin\{seksjon\}\{([^}]*)\}(.*?)\\end\{seksjon\}',body,re.S)
ut=[]
for tittel,inn in seksjoner:
    deler=['    <section class="bred">' if tittel=='Stoffverdier' else '    <section>',f'      <h2>{html.escape(tittel)}</h2>']
    if tittel=='Stoffverdier':
        for tab in re.findall(r'\\begin\{tabularx\}\{\\linewidth\}\{(?:[^{}]|\{[^}]*\})*\}(.*?)\\end\{tabularx\}',inn,re.S):
            tab=re.sub(r'\\(toprule|midrule|bottomrule)','',tab)
            rr=[x.strip() for x in tab.split('\\\\') if x.strip()]
            deler.append('      <table class="verdier">')
            for i,r in enumerate(rr):
                cel=[txt(c.strip()) for c in r.split('&')]
                tag='th' if i<2 else 'td'
                deler.append('        <tr>'+''.join(f'<{tag}>{c}</{tag}>' for c in cel)+'</tr>')
            deler.append('      </table>')
        deler.append('      <p class="merk">Verdier ved 1 atm.</p>')
    else:
        for blokk in re.findall(r'\\begin\{formler\}(.*?)\\end\{formler\}',inn,re.S): deler.append(tabell(rader(blokk)))
        p=re.search(r'Dekadiske prefikser\}\}\\\\(.*?)\\end\{tabularx\}',inn,re.S)
        if p:
            deler.append('      <p class="merk" style="color:var(--neon);font-family:\'Architects Daughter\',cursive;font-size:1rem">Dekadiske prefikser</p>\n      <table class="verdier prefiks">')
            for r in [x.strip() for x in p.group(1).split('\\\\') if x.strip()]:
                deler.append('        <tr>'+''.join(f'<td>{txt(c.strip())}</td>' for c in r.split('&'))+'</tr>')
            deler.append('      </table>')
        q=re.search(r'\\textbf\{isobar\}(.*?)\\end\{tabularx\}',inn,re.S)
        if q:
            deler.append('      <table>')
            for r in [x.strip() for x in ('\\textbf{isobar}'+q.group(1)).split('\\\\') if x.strip()]:
                a,_,b=r.partition('&'); deler.append(f'        <tr><td class="f">{txt(a)}</td><td class="h">{txt(b)}</td></tr>')
            deler.append('      </table>')
    deler.append('    </section>'); ut.append('\n'.join(deler))
hode=gammel[:gammel.index('<body>')]
hode=hode.replace("tex: { inlineMath","tex: { macros: { gc: '\\\\mathrm{g}', ec: '\\\\mathrm{e}', kB: '\\\\mathrm{k_B}', dvec: ['\\\\overrightarrow{\\\\Delta #1}', 1], enh: ['\\\\,\\\\mathrm{#1}', 1], sub: ['_\\\\textrm{#1}', 1] }, inlineMath")
side=hode+'''<body>
<main>
  <h1>Formelark <span>TRES0312</span></h1>
  <p class="under">Forkurs i fysikk · NTNU · formlene du har med på eksamen · <a href="tres0312.pdf" style="color:var(--neon)">last ned som PDF</a></p>

  <div class="tre">
'''+'\n'.join(ut)+'''
  </div>
</main>
</body>
</html>
'''
open(sys.argv[3],'w').write(side)
print(len(seksjoner))
