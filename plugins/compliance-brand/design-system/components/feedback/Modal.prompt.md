# Modal

Form and detail dialogs. Scrim rgba(9,9,11,.5), 12px radius, header/body/footer separated by hairlines.

```jsx
<Modal title="Solicitar férias" subtitle="Saldo disponível: 22 dias" onClose={fechar}
  footer={<><Button variant="secondary" onClick={fechar}>Cancelar</Button><Button onClick={enviar}>Enviar solicitação</Button></>}>
  …
</Modal>
```
