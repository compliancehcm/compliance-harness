# DataTable

All tabular data in the Portal (holerites, espelho de ponto, requisições de vaga). CSS grid, not <table>, so columns stay aligned while the card scrolls horizontally.

```jsx
<DataTable minWidth={560} onRowClick={abrir}
  columns={[{key:'mes',label:'Competência',width:'1.4fr'},{key:'liquido',label:'Líquido'}]}
  rows={holerites} />
```
