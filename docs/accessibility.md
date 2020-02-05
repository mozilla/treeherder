# Accessibility

## General Practices

As a general rule, accessible software is achieved by following web development best practices. As Treeherder uses the `reactstrap` library, it is recommended using one of its components, if possible.

If you can not find a suitable component, prefer [HTML5 semantic tags](https://developer.mozilla.org/en-US/docs/Glossary/Semantics#Semantics_in_HTML) and avoid using generic tags, such as `span` and `div`. Use those only when there is no other more semantic tag. Moreover, try to use more **headings** (`h1` to `h6`) whenever possible, because screen readers users usually navigate by headings and that is only possible when developers insert them in the code.

If you can build your layout neither with `reactstrap` nor with semantic tags, please insert an `aria-role`. Down below, there are some elements constructed that way in Treeherder:

- [Tables](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/Table_Role);
- [Progress Bar](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_progressbar_role);
- [List](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/List_role);

`aria-role` is important because it gives meaning to the generic HTML tag. That gives some direction to screen readers on which functionalities to provide and some information to users.

### Reactstrap

Some elements in Treeherder's UI are borrowed from the `reactstrap` library. As a general rule, its elements are already accessible.
That library is built on top of Bootstrap, therefore the [Bootstrap Accessibility documentation](https://getbootstrap.com/docs/4.0/getting-started/accessibility/) is the one to look for, if in doubt.

There are some issues on **Color Contrast** that are pointed by Bootstrap itself. This was solved in Treeherder by providing [**_custom color classes_**](accessibility.md#colors).

### Font Awesome

Treeherder also uses the `Font Awesome` library for some icons. Usually, there is no need to insert an additional explanation to them. However, if the icon has a semantic meaning, you can insert it by adding a `title` prop in the `FontAwesomeIcon` component.

```jsx
<FontAwesomeIcon icon={icon} title="Icon description" />
```

## Colors

Treeherder uses [Bootstrap color](https://getbootstrap.com/docs/4.0/utilities/colors/) utility classes. While most of them work, there are a couple that needed a little tweaking to increase **color contrast**, according to [WCAG standards](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Color_contrast?utm_source=devtools&utm_medium=a11y-panel-checks-color-contrast).

So, we ask that you substitute the Bootstrap color to the Treeherder one, according to the following table:

| Bootstrap Color | Treeherder Color       |
| --------------: | :--------------------- |
|      `btn-info` | `btn-darker-info`      |
|     `text-info` | `text-darker-info`     |
| `btn-secondary` | `btn-darker-secondary` |

For example, if inserting a text color into an element, use `className="text-darker-info"`, instead of using `className="text-info"`.

### Colors in buttons

In [`reactstrap`'s `Button` component](https://reactstrap.github.io/components/buttons/), you can insert a `prop` specifying its color. In that case, you use only the color name, without its prefix.

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

## Images

### Image HTML tag

If you add an image, make sure you also write an alternative text for it. The text should be descriptive and support the screen reader user.

```jsx
<img src={image} alt="A description of the image">
```

If you are not sure how to write this, please refer to [this guide](https://webaim.org/techniques/alttext/).

### SVG

For SVG images, do the following:

- `<svg>` should have `aria-labelledby` attribute, with the ids of the following elements, separated by a blank space. It should also have a `role="img"`;
- As the first child of `<svg>`, add `<title>` with an `id` attribute. The content of this element should be the title of the image;
- (_Optional_) Following `<title>`, you can add `<desc>`, which describes the image. You should also add an `id`.

```jsx
<svg aria-labelledby="imageTitle imageDesc" role="img">
  <title id="imageTitle"> A title of this image </title>
  <desc id="imageDesc"> A description of this image </desc>
  // ...
</svg>
```

If your case is more specific, please check [this guide](https://css-tricks.com/accessible-svgs/#article-header-id-1).

## Interactive elements

When creating elements that have event listeners, prefer any component of the `reactstrap` interactive elements. Examples are: `Button`, `Input`, `DropdownToggle`. You can also choose a HTML `<a>` element.

If you need to insert an event listener in a non-interactive element, such as a `span`, add also an `aria-role` of `button`, `link`, `checkbox`, or whatever seems closer to the functionality of the element.

```html
<span onClick="{someFunction}" aria-role="button">
  Unconventional button
</span>
```

### Dropdown menu

There is a special case when you are creating a dropdown menu. First of all, try to follow [`reactstrap` structure](https://reactstrap.github.io/components/dropdowns/).

Lastly, insert an additional tag `prop` to `DropdownItem` component.

```jsx
<DropdownItem tag="a"> Menu Item </DropdownItem>
```

## Forms, inputs and buttons

Apart from inserting high color contrast combinations in buttons, also make sure it has a `:focus` style (usually a blue outline is enough). If you use `reactstrap`'s `Button` component, this is added by default, hence it is recommended.

In case the content of the button is not a text (an icon or graphical element, for example), this element should have an `aria-label`, explaining what it does.

```jsx
<Button aria-label="Bookmark this" onClick={onClickFunction}>
  <FontAwesomeIcon icon={icon} />
</Button>
```

For input and checkbox, those are important to be labeled - placeholders are not enough for screen reader users. For example, when inserting an email input and a checkbox, using `reactstrap`, the structure should be:

```jsx
<Form>
  <FormGroup>
    <Label for="email">Email</Label>
    <Input
      type="email"
      name="email"
      id="email"
      placeholder="Insert your email"
    />
  </FormGroup>

  <FormGroup>
    <Label check>
      <Input type="checkbox" /> I agree with the terms
    </Label>
  </FormGroup>
</Form>
```

If in doubt, please check the [`reactstrap` Form documentation](https://reactstrap.github.io/components/form/).

## Specific elements

### Progress Bar

Across Perfherder, there are some Progress Bars, which are built using `reactstrap` components. There is still an [issue](https://github.com/reactstrap/reactstrap/issues/1681), however, when adding labels on each bar. While this is still not solved, it is recommended to add an `aria-label` in the wrapping component, explaining the values of the bar.

An example from the Alerts view:

```jsx
<Progress
  multi
  aria-label={`Magnitude of difference based on lower is better. Metric: ${
    regression ? 100 - magnitude : magnitude
  } % regressed`}
>
  <div aria-hidden="true" className="progress w-100">
    <Progress bar value={regression ? 100 - magnitude : magnitude} />
    <Progress bar value={regression ? magnitude : 100 - magnitude} />
  </div>
</Progress>
```

### Tables

In tables, there should always be headers.

```jsx
<Table>
  <thead>
    <tr>
      <th> First header </th>
      <th> Second header </th>
      <th> Third header </th>
    </tr>
  </thead>
  // ...table's body
</Table>
```

Also, if you are not using `<table>` tag or `reactstrap`'s `Table` component to create the table, please use [all the necessary `role` attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/Table_Role).

Alternatively, you may choose to use the `React Table` library. The only requirement here is to insert a `role="table"`, like this:

```jsx
<ReactTable
  getTableProps={() => ({ role: 'table' })}
  // ...other table's props
/>
```

### Other Components (Third-Party)

Take special care when bringing in new elements/components to the app. They should have a good documentation on accessibility and should be tested beforehand by an a11y fellow.

## References

- [WAI-ARIA Authoring Practices](https://www.w3.org/TR/wai-aria-practices-1.1/) is the official document that covers specific cases for creating accessible web applications.
- [Auditing For Accessibility Problems With Firefox Developer Tools](https://hacks.mozilla.org/2019/10/auditing-for-accessibility-problems-with-firefox-developer-tools/) is a guide on how to use the Accessibility tab in Firefox Devtools.
- [Accessibility Inspector](https://developer.mozilla.org/en-US/docs/Tools/Accessibility_inspector) is the official documentation for Accessibility Inspector in Firefox Devtools.
