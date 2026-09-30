# DropdownMenu

Popover surface for the user menu, notifications and the mobile nav. Ships with MenuSection and MenuItem.

```jsx
<DropdownMenu open={aberto} onClose={fechar} anchor={{right:16, top:60}}>
  <MenuSection label="Tema">
    <MenuItem label="Claro" selected onClick={…} />
  </MenuSection>
</DropdownMenu>
```

MenuItem shows a 14px check in a fixed 16px gutter when selected, so labels stay aligned.
