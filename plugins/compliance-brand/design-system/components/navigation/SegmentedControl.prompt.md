# SegmentedControl

Two-to-three way switch on a --muted track. In the Portal it swaps persona (Funcionário / Líder · Gestor).

```jsx
<SegmentedControl value={persona} onChange={setPersona}
  options={[{value:'funcionario',label:'Funcionário'},{value:'gestor',label:'Líder / Gestor'}]} />
```
