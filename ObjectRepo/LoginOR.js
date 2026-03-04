module.exports = {
        closeButton : "//span[@data-cy='closeModal']",
        botCloseButton : "//div[contains(@class,'header-icon')]//img[@alt='minimize']",
        selectTrain : "//a[@href='https://www.makemytrip.com/railways/']",
        selectBookTrainTickets : "//span[text()='Book Train Tickets']//span[@class='checkmark']",
        fromCity : "input[id='fromCity']",
        enterFromCity : "//input[@id='fromCity']//parent::label/following-sibling::div/div/div/div[@role='combobox']/input[@type='text']",
        fromCitySuggestion : "//input[@id='fromCity']//parent::label/following-sibling::div/div/div/div[@role='combobox']/div/div/ul/li[@role='option']",
        toCity: "input[id='toCity']",
        enterToCity: "//input[@id='toCity']//parent::label/following-sibling::div/div/div/div[@role='combobox']/input[@type='text']",
        toCitySuggestion : "//input[@id='toCity']//parent::label/following-sibling::div/div/div/div[@role='combobox']/div/div/ul/li[@role='option']",
        searchButton : "//a[@data-cy='submit' and text()='Search']",
        travelDateText : "input[id='travelDate']",
        nextMonthButton : "//button[@name='next-month']",
        previousMonthButton : "//button[@name='previous-month']",
        dateText : "//div[@aria-live='polite' and contains(@class,'style_caption_label')]", 
        //----------------------------------------------------------
        usernameTextBox : "input[id='username']",
        passwordTextBox : "input[id='password']",
        submitButton : "button[id='submit']",
        homeTab : "//a[text()='Home']",
        
};