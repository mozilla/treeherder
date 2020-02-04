# Accessibility

## Colors

Treeherder uses [Bootstrap color](https://getbootstrap.com/docs/4.0/utilities/colors/) utility classes. While most of them work, there are a couple that needed a little tweaking in order to increase **color contrast**, according to [WCAG standards](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast?utm_source=devtools&utm_medium=a11y-panel-checks-color-contrast).

So, we ask that you substitute the Bootstrap color to the Treeherder one, according to the following table:

| Bootstrap Color | Treeherder Color       |
| --------------: | :--------------------- |
|      `btn-info` | `btn-darker-info`      |
|     `text-info` | `text-darker-info`     |
| `btn-secondary` | `btn-darker-secondary` |

For example, if inserting a text color into an element, use `className="text-darker-info"`, instead of using `className="text-info"`.

### Colors in buttons

In [`reactstrap`'s `<Button>` component](https://reactstrap.github.io/components/buttons/), you can insert a `prop` specifying its color. In that case, you use only the color name, without its prefix.

| Treeherder Color | Button prop color  |
| ---------------: | :----------------- |
|       `btn-info` | `darker-info`      |
|  `btn-secondary` | `darker-secondary` |

For example:

```jsx
<Button color="darker-info">
  Info colored button with contrast passing score
</Button>
```

### Inserting new colors

If you add new colors to the style sheets, please make sure the text and background color combination passes the minimum contrast ratio defined by WCAG.

In order to check if it passes, you can use [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/) or use [Firefox's Accessibility Devtools](https://developer.mozilla.org/en-US/docs/Tools/Accessibility_inspector#Check_for_accessibility_issues).

### Red and Green

Red and green colors are not very noticeable for some types of color deficiency. For that reason, it is recommended to insert an accompanying icon, such as a checkmark (for success) or an exclamation point (for warning or error).

For that task, `FontAwesome` is a supported choice.

## Interactive elements

When creating elements that have event listeners, prefer any component of the `reactstrap` interactive elements. Examples are: `<Button>`, `<Input>`, `<DropdownToggle>`.

### Dropdown menu

There is a special case, when you are creating a dropdown menu. First of all, try to follow [`reactstrap` structure](https://reactstrap.github.io/components/dropdowns/).

Lastly, insert an additional tag `prop` to `DropdownItem` component.

```jsx
<DropdownItem tag="a"> Menu Item </DropdownItem>
```
